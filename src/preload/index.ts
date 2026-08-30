import { contextBridge, ipcRenderer } from 'electron'

const api = {
  saveExport: (args: {
    dataUrl: string
    defaultName: string
    ext: 'png' | 'pdf'
  }): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> =>
    ipcRenderer.invoke('export:save', args)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
