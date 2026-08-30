import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    title: '원고지 첨삭 도우미',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---- IPC: export to PNG / PDF via native save dialog ----

ipcMain.handle(
  'export:save',
  async (_e, args: { dataUrl: string; defaultName: string; ext: 'png' | 'pdf' }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: args.defaultName,
      filters: [
        args.ext === 'png'
          ? { name: 'PNG 이미지', extensions: ['png'] }
          : { name: 'PDF 문서', extensions: ['pdf'] }
      ]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    const base64 = args.dataUrl.replace(/^data:.*?;base64,/, '')
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    return { ok: true, filePath }
  }
)

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
