'use strict'
const { contextBridge, ipcRenderer } = require('electron')
const path = require('path')

// Resolve a versão do package.json empacotado — npm_package_version não existe no app instalado
function resolveVersion () {
  try {
    const pkgPath = path.join(__dirname, 'package.json')
    return require(pkgPath).version
  } catch {
    return process.env.npm_package_version || '1.0.0'
  }
}

contextBridge.exposeInMainWorld('tusab', {
  platform: process.platform,
  version:  resolveVersion(),

  // Watchdog: recebe eventos do main process quando o backend cai ou volta
  onBackendDead:  (cb) => ipcRenderer.on('backend-dead',  () => cb()),
  onBackendAlive: (cb) => ipcRenderer.on('backend-alive', () => cb()),

  // Reinicia o processo Python via main process
  restartBackend: () => ipcRenderer.invoke('restart-backend'),

  // safeStorage: API keys no OS keychain (Windows DPAPI / macOS Keychain)
  // Retornam null/false quando rodando fora do Electron (dev server puro)
  getApiKey:    (provider)           => ipcRenderer.invoke('get-api-key',    provider),
  setApiKey:    (provider, key)      => ipcRenderer.invoke('set-api-key',    provider, key),
  deleteApiKey: (provider)           => ipcRenderer.invoke('delete-api-key', provider),

  // Preferência de auto-update do Electron (persiste no keystore local)
  getUpdatePref: ()        => ipcRenderer.invoke('get-update-pref'),
  setUpdatePref: (enabled) => ipcRenderer.invoke('set-update-pref', enabled),

  // Abre terminal com comando pré-preenchido (ex: ollama pull llama3.2:3b)
  openTerminal: (command) => ipcRenderer.invoke('open-terminal', command),

  // Notificações de atualização do app (electron-updater → frontend)
  onUpdateAvailable:       (cb) => ipcRenderer.on('update-available',       (_e, info) => cb(info)),
  onUpdateDownloaded:      (cb) => ipcRenderer.on('update-downloaded',      (_e, info) => cb(info)),
  onTriggerInstallUpdate:  (cb) => ipcRenderer.on('trigger-install-update', () => cb()),
  onAppJustUpdated:        (cb) => ipcRenderer.on('app-just-updated',       (_e, info) => cb(info)),
  installUpdate:   (version) => ipcRenderer.invoke('install-update', version),
  // Verificação manual de atualização (botão na aba Admin) — funciona mesmo
  // com auto-update desativado. Retorna { status, version?, current?, message? }
  checkForUpdates: ()        => ipcRenderer.invoke('check-for-updates'),
})
