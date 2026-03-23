import 'dotenv/config'
import path from 'node:path'

const { app, BrowserWindow, ipcMain } = require('electron') as typeof import('electron')

const isDev = !app.isPackaged
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'

let controlWindow: import('electron').BrowserWindow | null = null

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 500,
    height: 155,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 155,
    maxHeight: 155,
    x: 0,
    y: 0,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })

  if (isDev) {
    void controlWindow.loadURL(devServerUrl)
  } else {
    void controlWindow.loadFile(path.join(__dirname, '../../ui/dist/index.html'))
  }

  controlWindow.on('closed', () => {
    controlWindow = null
  })
}

ipcMain.handle('licord:ping', () => ({ ok: true, timestamp: Date.now() }))

app.whenReady().then(() => {
  createControlWindow()
})

app.on('window-all-closed', () => {
  // Linux/Windows convention: quit when all windows close.
  if (process.platform !== 'darwin') app.quit()
})

