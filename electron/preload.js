'use strict'
// Preload minimalista — o app usa a API HTTP diretamente, sem IPC.
// Mantido aqui para extensões futuras (ex: notificações nativas, menus).
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('tusab', {
  platform: process.platform,
  version:  process.env.npm_package_version || '2.0.0',
})
