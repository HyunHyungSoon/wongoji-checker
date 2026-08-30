import type { Api } from './index'

declare global {
  interface Window {
    // Electron 창에서는 preload가 주입한다. 브라우저 탭에서는 없다.
    api?: Api
  }
}

export {}
