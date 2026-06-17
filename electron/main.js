// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
// Todos os direitos reservados. Proibida a reprodução sem autorização expressa.

'use strict'

const { app, BrowserWindow, shell, dialog } = require('electron')
const { spawn }  = require('child_process')
const path       = require('path')
const http       = require('http')
const fs         = require('fs')

// ─── Resolução de caminhos (dev vs. prod) ──────────────────────────────────
const IS_PACKED   = app.isPackaged
const RESOURCES   = IS_PACKED ? process.resourcesPath : path.join(__dirname, '..')
const BACKEND_DIR = path.join(RESOURCES, IS_PACKED ? 'app'        : '.')
const PYTHON_EXE  = path.join(RESOURCES, IS_PACKED ? 'python_env' : '..', 'python_env', 'python.exe')
const BIN_DIR     = path.join(RESOURCES, IS_PACKED ? 'bin'        : '..', 'bin')

// Em desenvolvimento usa o Python do sistema se python_env ainda não existe
const PYTHON = (IS_PACKED || require('fs').existsSync(PYTHON_EXE))
  ? PYTHON_EXE
  : 'python'

const PORT = 8001

// ─── Estado global ─────────────────────────────────────────────────────────
let mainWindow    = null
let pythonProcess = null
let ollamaProcess = null

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
    TUSAB_DATA_DIR: app.getPath('userData'),
    // Coloca yt-dlp.exe e node.exe no PATH para o processo Python
    PATH: `${BIN_DIR}${path.delimiter}${process.env.PATH}`,
  }

  pythonProcess = spawn(
    PYTHON,
    [path.join(BACKEND_DIR, 'api_tusab.py')],
    { cwd: BACKEND_DIR, env, windowsHide: true }
  )

  pythonProcess.stdout.on('data', d => console.log('[py]', d.toString().trim()))
  pythonProcess.stderr.on('data', d => console.error('[py]', d.toString().trim()))
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
function waitForBackend (maxMs = 20000) {
  const deadline = Date.now() + maxMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
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
  } catch (err) {
    dialog.showErrorBox(
      "Tusab — Erro de inicialização",
      `O backend não respondeu a tempo.\n\n${err.message}\n\nVerifique se o Python e as dependências estão instaladas corretamente.`
    )
    app.quit()
  }
}

// ─── Auto-update ──────────────────────────────────────────────────────────
function setupAutoUpdater () {
  if (!IS_PACKED) return  // só verifica em produção
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload    = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', info => {
      console.log('[update] nova versão disponível:', info.version)
    })

    autoUpdater.on('update-downloaded', info => {
      dialog.showMessageBox({
        type:    'info',
        title:   'Atualização disponível',
        message: `Tusab ${info.version} foi baixado.\nA atualização será instalada ao fechar o app.`,
        buttons: ['Instalar agora', 'Depois'],
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.on('error', e => console.error('[update] erro:', e.message))
    autoUpdater.checkForUpdatesAndNotify()
  } catch (e) {
    console.error('[update] electron-updater não disponível:', e.message)
  }
}

// ─── Ciclo de vida do app ──────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureOllama().catch(e => console.error('[ollama] erro:', e))
  spawnBackend()
  createWindow()
  setupAutoUpdater()

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
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM')
    pythonProcess = null
  }
}
