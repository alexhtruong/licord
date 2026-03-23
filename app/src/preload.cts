const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

contextBridge.exposeInMainWorld('licord', {
  versions: process.versions,
  ping: () => ipcRenderer.invoke('licord:ping'),
})

