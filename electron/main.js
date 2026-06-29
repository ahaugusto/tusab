// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
// Todos os direitos reservados. Proibida a reprodução sem autorização expressa.

'use strict'

const { app, BrowserWindow, shell, dialog, ipcMain, safeStorage, Notification, Menu } = require('electron')
const { spawn }  = require('child_process')
const path       = require('path')
const http       = require('http')
const fs         = require('fs')

// ─── Resolução de caminhos (dev vs. prod) ──────────────────────────────────
// app.isPackaged não está disponível no top-level antes de app.ready;
// detectamos via process.resourcesPath (só existe em produção empacotada)
const IS_PACKED   = typeof process.resourcesPath === 'string' && !process.resourcesPath.includes('node_modules')
const RESOURCES   = IS_PACKED ? process.resourcesPath : path.join(__dirname, '..')
const BACKEND_DIR = IS_PACKED ? path.join(RESOURCES, 'app')            : RESOURCES
const PYTHON_EXE  = IS_PACKED ? path.join(RESOURCES, 'python_env', 'python.exe')
                               : path.join(RESOURCES, 'electron', 'python_env', 'python.exe')
const BIN_DIR     = IS_PACKED ? path.join(RESOURCES, 'bin')            : path.join(RESOURCES, 'electron', 'bin')

// Em desenvolvimento usa o .venv local se existir, depois python_env, depois python do sistema
const VENV_PYTHON = path.join(RESOURCES, '..', '.venv', 'Scripts', 'python.exe')
const PYTHON = IS_PACKED
  ? PYTHON_EXE
  : (require('fs').existsSync(VENV_PYTHON)
      ? VENV_PYTHON
      : require('fs').existsSync(PYTHON_EXE)
        ? PYTHON_EXE
        : 'python')

const PORT = 8001

// ─── Estado global ─────────────────────────────────────────────────────────
let mainWindow    = null
let pythonProcess = null
let ollamaProcess = null
let watchdogTimer = null
let backendDead   = false
let pyStderrLines = []   // últimas linhas de stderr do Python — exibidas no erro de timeout

// ─── Ollama ────────────────────────────────────────────────────────────────
function findOllamaExe () {
  const os       = require('os')
  const platform = os.platform()

  const candidates = platform === 'win32'
    ? [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Ollama', 'ollama.exe'),
        'ollama',
      ]
    : platform === 'darwin'
      ? [
          '/Applications/Ollama.app/Contents/Resources/ollama',
          path.join(os.homedir(), 'Applications', 'Ollama.app', 'Contents', 'Resources', 'ollama'),
          '/usr/local/bin/ollama',
          'ollama',
        ]
      : [  // Linux
          '/usr/local/bin/ollama',
          '/usr/bin/ollama',
          path.join(os.homedir(), '.local', 'bin', 'ollama'),
          'ollama',
        ]

  return candidates.find(p => p === 'ollama' || fs.existsSync(p)) || null
}

function getOllamaPlatformConfig () {
  const os      = require('os')
  const platform = os.platform()
  const arch     = os.arch()

  if (platform === 'win32') {
    return {
      url:      'https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe',
      filename: 'OllamaSetup.exe',
      install:  (file) => {
        const proc = spawn(file, ['/S'], { windowsHide: true, detached: true, stdio: 'ignore' })
        proc.unref()
      },
    }
  }

  if (platform === 'darwin') {
    const suffix = arch === 'arm64' ? 'arm64' : 'x86_64'
    return {
      url:      `https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin-${suffix}.zip`,
      filename: 'Ollama-darwin.zip',
      install:  async (file) => {
        // Extrai e move para /Applications
        const { execSync } = require('child_process')
        execSync(`unzip -o "${file}" -d /tmp/ollama_extract`)
        execSync('mv -f /tmp/ollama_extract/Ollama.app /Applications/Ollama.app 2>/dev/null || true')
        execSync('open /Applications/Ollama.app')
      },
    }
  }

  // Linux
  return {
    url:      null,  // usa script oficial
    filename: null,
    install:  async () => {
      const { exec } = require('child_process')
      exec('curl -fsSL https://ollama.com/install.sh | sh', { shell: '/bin/bash' })
    },
  }
}

async function installOllama () {
  const config = getOllamaPlatformConfig()
  console.log(`[ollama] plataforma detectada: ${require('os').platform()} — ${require('os').arch()}`)

  try {
    if (config.url) {
      const https        = require('https')
      const tmpInstaller = path.join(app.getPath('temp'), config.filename)
      console.log('[ollama] baixando instalador...')

      await new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(tmpInstaller)
        const download   = (url, redirects = 0) => {
          if (redirects > 5) return reject(new Error('Too many redirects'))
          https.get(url, { headers: { 'User-Agent': 'tusab' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302)
              return download(res.headers.location, redirects + 1)
            if (res.statusCode !== 200)
              return reject(new Error(`HTTP ${res.statusCode}`))
            res.pipe(fileStream)
            fileStream.on('finish', () => { fileStream.close(); resolve() })
            fileStream.on('error', reject)
          }).on('error', reject)
        }
        download(config.url)
      })

      console.log('[ollama] instalando...')
      await config.install(tmpInstaller)
    } else {
      console.log('[ollama] executando script de instalação Linux...')
      await config.install()
    }
  } catch (e) {
    console.error('[ollama] falha na instalação:', e.message)
  }
}

function sendToLoading (js) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(js).catch(() => {})
  }
}

async function ensureOllama () {
  const exe = findOllamaExe()

  if (!exe) {
    console.log('[ollama] não instalado — baixando...')
    sendToLoading(`window.setStatus('Baixando Ollama — motor de IA local (~50 MB)...', true)`)
    sendToLoading(`window.setProgress(0)`)
    sendToLoading(`window.setNotice('Isso acontece apenas uma vez. O Ollama é necessário para o Agente IA funcionar offline e gratuitamente.')`)
    await installOllama()
    sendToLoading(`window.setStatus('Instalando Ollama...', true)`)
    await new Promise(r => setTimeout(r, 8000))
    sendToLoading(`window.setProgress(-1)`)
  }

  // Tenta conectar ao servidor Ollama já em execução
  const running = await new Promise(resolve => {
    http.get('http://127.0.0.1:11434/api/tags', res => { res.resume(); resolve(true) })
      .on('error', () => resolve(false))
  })

  if (running) { console.log('[ollama] já está rodando'); return }

  const exeFinal = findOllamaExe()
  if (!exeFinal || exeFinal === 'ollama') {
    console.log('[ollama] executável não encontrado após instalação')
    return
  }

  sendToLoading(`window.setStatus('Iniciando motor de IA local...', true)`)
  console.log('[ollama] iniciando servidor...')
  ollamaProcess = spawn(exeFinal, ['serve'], {
    windowsHide: true, detached: true, stdio: 'ignore',
    env: { ...process.env }
  })
  ollamaProcess.unref()
  await new Promise(r => setTimeout(r, 2000))
  sendToLoading(`window.setStatus('Iniciando backend...', false)`)
  console.log('[ollama] servidor iniciado')
}

// ─── Backend ───────────────────────────────────────────────────────────────
function spawnBackend () {
  const env = {
    ...process.env,
    PYTHONUNBUFFERED:  '1',
    ELECTRON_RUN:      '1',
    TUSAB_DATA_DIR: IS_PACKED ? app.getPath('userData') : BACKEND_DIR,
    // Coloca yt-dlp.exe e node.exe no PATH para o processo Python
    PATH: `${BIN_DIR}${path.delimiter}${process.env.PATH}`,
  }

  pythonProcess = spawn(
    PYTHON,
    ['-X', 'utf8', path.join(BACKEND_DIR, 'api_tusab.py')],
    { cwd: BACKEND_DIR, env, windowsHide: true }
  )

  pythonProcess.stdout.on('data', d => console.log('[py]', d.toString().trim()))
  pythonProcess.stderr.on('data', d => {
    const line = d.toString().trim()
    console.error('[py]', line)
    // Guarda as últimas 20 linhas para exibir no diálogo de erro
    pyStderrLines.push(...line.split('\n'))
    if (pyStderrLines.length > 20) pyStderrLines = pyStderrLines.slice(-20)
  })
  pythonProcess.on('exit', code => {
    console.log('[py] processo encerrado com código:', code)
    // Se o backend morreu inesperadamente e a janela ainda está aberta, avisa
    if (mainWindow && code !== 0 && code !== null) {
      mainWindow.webContents.executeJavaScript(
        `console.error('Backend encerrado inesperadamente (código ${code})')`
      ).catch(() => {})
    }
  })
}

// ─── Aguarda o backend estar pronto ────────────────────────────────────────
function waitForBackend (maxMs = 90000) {
  const deadline = Date.now() + maxMs
  const start    = Date.now()

  // Mensagens progressivas conforme o tempo passa (ms decorrido → msg)
  const PROGRESS_MSGS = [
    [0,     'Iniciando backend...'],
    [8000,  'Carregando modelos de IA...'],
    [20000, 'Carregando modelos de IA (pode levar ate 1 min na primeira vez)...'],
    [40000, 'Ainda inicializando — aguarde mais um momento...'],
    [70000, 'Quase pronto...'],
  ]
  let lastMsgIdx = -1

  return new Promise((resolve, reject) => {
    const attempt = () => {
      // Atualiza mensagem de status conforme o tempo decorrido
      const elapsed = Date.now() - start
      for (let i = PROGRESS_MSGS.length - 1; i >= 0; i--) {
        if (elapsed >= PROGRESS_MSGS[i][0] && lastMsgIdx < i) {
          lastMsgIdx = i
          const msg = PROGRESS_MSGS[i][1].replace(/'/g, "\\'")
          sendToLoading(`window.setStatus('${msg}', ${i >= 1})`)
          break
        }
      }

      http.get(`http://127.0.0.1:${PORT}/status`, res => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        schedule()
      }).on('error', schedule)
    }
    const schedule = () => {
      if (Date.now() >= deadline) return reject(new Error('Timeout aguardando backend'))
      setTimeout(attempt, 400)
    }
    attempt()
  })
}

// ─── Watchdog pós-inicialização ────────────────────────────────────────────
function pingBackend () {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${PORT}/status`, res => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(3000, () => { req.destroy(); resolve(false) })
  })
}

function startWatchdog () {
  if (watchdogTimer) return
  watchdogTimer = setInterval(async () => {
    const alive = await pingBackend()
    if (!alive && !backendDead) {
      backendDead = true
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-dead')
      }
    } else if (alive && backendDead) {
      backendDead = false
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-alive')
      }
    }
  }, 5000)
}

function stopWatchdog () {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
}

// ─── safeStorage: API keys ────────────────────────────────────────────────
const KEYSTORE_PATH = () => path.join(app.getPath('userData'), 'config', 'keystore.json')

function readKeystore () {
  try { return JSON.parse(fs.readFileSync(KEYSTORE_PATH(), 'utf-8')) } catch { return {} }
}

function writeKeystore (store) {
  const p = KEYSTORE_PATH()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(store), 'utf-8')
}

function registerIpcHandlers () {
  // IPC: frontend pede reinício do backend
  ipcMain.handle('restart-backend', async () => {
    stopWatchdog()
    if (pythonProcess) { try { pythonProcess.kill('SIGTERM') } catch {} pythonProcess = null }
    await new Promise(r => setTimeout(r, 1000))
    spawnBackend()
    try {
      await waitForBackend(15000)
      backendDead = false
      startWatchdog()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('get-api-key', (_e, provider) => {
    if (!safeStorage.isEncryptionAvailable()) return null
    const store = readKeystore()
    const enc   = store[`apikey_${provider}`]
    if (!enc) return null
    try { return safeStorage.decryptString(Buffer.from(enc, 'base64')) } catch { return null }
  })

  ipcMain.handle('set-api-key', (_e, provider, plaintext) => {
    if (!safeStorage.isEncryptionAvailable()) return false
    const enc   = safeStorage.encryptString(plaintext).toString('base64')
    const store = readKeystore()
    store[`apikey_${provider}`] = enc
    writeKeystore(store)
    return true
  })

  ipcMain.handle('delete-api-key', (_e, provider) => {
    if (!safeStorage.isEncryptionAvailable()) return false
    const store = readKeystore()
    delete store[`apikey_${provider}`]
    writeKeystore(store)
    return true
  })

  // Preferência de auto-update do Electron (salva no keystore como flag simples)
  ipcMain.handle('get-update-pref', () => {
    const store = readKeystore()
    // Padrão: habilitado (true) — só retorna false se explicitamente desativado
    return store['electron_auto_update'] !== false
  })

  ipcMain.handle('set-update-pref', (_e, enabled) => {
    const store = readKeystore()
    store['electron_auto_update'] = !!enabled
    writeKeystore(store)
    return true
  })

  // Abre terminal com comando ollama pull pré-preenchido
  ipcMain.handle('open-terminal', (_e, command) => {
    const { exec } = require('child_process')
    const safe = (command || '').replace(/[;&|`$]/g, '').trim()
    if (process.platform === 'win32') {
      exec(`start cmd /K "${safe}"`)
    } else if (process.platform === 'darwin') {
      exec(`osascript -e 'tell app "Terminal" to do script "${safe}"' -e 'tell app "Terminal" to activate'`)
    } else {
      // Linux: tenta terminais comuns
      const terms = ['gnome-terminal -- bash -c', 'xterm -e', 'konsole -e']
      exec(`${terms[0]} '${safe}; exec bash'`)
    }
    return true
  })
}

// ─── Janela principal ──────────────────────────────────────────────────────
async function createWindow () {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          820,
    minWidth:        960,
    minHeight:       600,
    icon:            path.join(RESOURCES, 'assets', 'logo.ico'),
    title:           "Tusab",
    show:            false,
    backgroundColor: '#0f172a',   // mesma cor do splash React
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  // Links externos abrem no browser padrão, não dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // Mostra loading enquanto o backend sobe
  mainWindow.loadFile(path.join(__dirname, 'loading.html'))
  mainWindow.show()

  try {
    await waitForBackend()
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
    startWatchdog()

    // Após a página carregar, checar se voltamos de uma atualização automática
    mainWindow.webContents.once('did-finish-load', () => {
      try {
        const store = readKeystore()
        if (store['just_updated_version']) {
          const version = store['just_updated_version']
          delete store['just_updated_version']
          writeKeystore(store)
          // Pequeno delay para o React montar antes de receber o evento
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('app-just-updated', { version })
            }
          }, 1500)
        }
      } catch {}
    })
  } catch (err) {
    const pyLog = pyStderrLines.length > 0
      ? `\n\nLog do Python (últimas linhas):\n${pyStderrLines.join('\n')}`
      : ''
    dialog.showErrorBox(
      "Tusab — Erro de inicialização",
      `O backend não respondeu a tempo.\n\n${err.message}${pyLog}\n\nSe este é o primeiro uso, aguarde alguns minutos e tente novamente. Se o problema persistir, contate tusab@tusab.solutions`
    )
    app.quit()
  }
}

// ─── Auto-update ──────────────────────────────────────────────────────────
function setupAutoUpdater () {
  if (!IS_PACKED) return  // só verifica em produção
  try {
    // Respeita a preferência do usuário salva no keystore
    const store = readKeystore()
    if (store['electron_auto_update'] === false) {
      console.log('[update] atualização automática desativada pelo usuário')
      return
    }

    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload    = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', info => {
      console.log('[update] nova versão disponível:', info.version)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', { version: info.version })
      }
    })

    autoUpdater.on('update-downloaded', info => {
      console.log('[update] download concluído:', info.version)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', { version: info.version })
      }
      // Notificação nativa com ação de clique para instalar
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: `Tusab ${info.version} pronto para instalar`,
          body: 'Clique aqui para instalar a atualização e reiniciar o app.',
          icon: path.join(__dirname, 'logo_loading.png'),
          silent: false,
        })
        notif.on('click', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.focus()
            mainWindow.webContents.send('trigger-install-update')
          }
        })
        notif.show()
      }
    })

    ipcMain.handle('install-update', (_e, newVersion) => {
      // Grava flag de "acabou de atualizar" para exibir modal pós-restart
      try {
        const store = readKeystore()
        store['just_updated_version'] = newVersion || autoUpdater.currentVersion?.version || ''
        writeKeystore(store)
      } catch {}
      // false = não fechar imediatamente antes de instalar; true = reabrir o app após instalar
      autoUpdater.quitAndInstall(false, true)
    })

    autoUpdater.on('error', e => console.error('[update] erro:', e.message))
    autoUpdater.checkForUpdatesAndNotify()
  } catch (e) {
    console.error('[update] electron-updater não disponível:', e.message)
  }
}

// ─── Janela de help ───────────────────────────────────────────────────────
let helpWindow = null

function openHelpWindow () {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.focus()
    return
  }
  helpWindow = new BrowserWindow({
    width:           820,
    height:          680,
    minWidth:        560,
    minHeight:       420,
    title:           'Tusab — Ajuda',
    icon:            path.join(RESOURCES, 'assets', 'logo.ico'),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })
  helpWindow.loadFile(path.join(__dirname, 'help.html'))
  helpWindow.setMenuBarVisibility(false)
  helpWindow.on('closed', () => { helpWindow = null })
  // Links externos abrem no browser padrão
  helpWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  helpWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

function setupAppMenu () {
  const template = [
    {
      label: 'Tusab',
      submenu: [
        { role: 'about', label: 'Sobre o Tusab' },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Ajuda / Help',
      submenu: [
        {
          label: 'Abrir Ajuda… / Open Help…',
          accelerator: 'F1',
          click: () => openHelpWindow(),
        },
        { type: 'separator' },
        {
          label: 'Reportar bug…',
          click: () => shell.openExternal('https://github.com/ahaugusto/tusab-public/issues'),
        },
        {
          label: 'E-mail de suporte',
          click: () => shell.openExternal('mailto:tusab@tusab.solutions'),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── Ciclo de vida do app ──────────────────────────────────────────────────
app.whenReady().then(() => {
  registerIpcHandlers()
  ensureOllama().catch(e => console.error('[ollama] erro:', e))
  spawnBackend()
  createWindow()
  setupAutoUpdater()
  setupAppMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killBackend()
  app.quit()
})

app.on('before-quit', killBackend)

function killBackend () {
  stopWatchdog()
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM')
    pythonProcess = null
  }
}
