import jsPDF from 'jspdf'

function todayStamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

/** Decode a `data:<mime>;base64,<payload>` URL into a Blob, without fetch(). */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'application/octet-stream'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Save a data URL to disk.
 *
 * In the Electron window `window.api` is injected by the preload and gives us a
 * native save dialog. When the same renderer is opened in a plain browser tab
 * (e.g. http://localhost:5174 during dev), `window.api` is undefined — so fall
 * back to a normal anchor download instead of throwing.
 */
async function saveDataUrl(
  dataUrl: string,
  defaultName: string,
  ext: 'png' | 'pdf'
): Promise<{ ok: boolean; canceled?: boolean }> {
  if (window.api?.saveExport) {
    return window.api.saveExport({ dataUrl, defaultName, ext })
  }

  // Browser fallback: trigger a download via a temporary <a download>.
  // Decode the data URL to a Blob by hand — fetch(data:…) is blocked by the
  // app's Content Security Policy (default-src 'self').
  const url = URL.createObjectURL(dataUrlToBlob(dataUrl))
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { ok: true }
}

/**
 * Rasterize an <svg> element to a 2x-resolution canvas. Rendering the grid as
 * SVG keeps export crisp regardless of screen DPI.
 */
async function svgToCanvas(svg: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> {
  const width = svg.viewBox.baseVal.width || svg.clientWidth
  const height = svg.viewBox.baseVal.height || svg.clientHeight

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const xml = new XMLSerializer().serializeToString(clone)
  const svg64 = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG 이미지를 불러오지 못했습니다.'))
    img.src = svg64
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function exportPng(
  svg: SVGSVGElement
): Promise<{ ok: boolean; canceled?: boolean }> {
  const canvas = await svgToCanvas(svg, 2)
  const dataUrl = canvas.toDataURL('image/png')
  return saveDataUrl(dataUrl, `첨삭결과_${todayStamp()}.png`, 'png')
}

export async function exportPdf(
  svg: SVGSVGElement
): Promise<{ ok: boolean; canceled?: boolean }> {
  const canvas = await svgToCanvas(svg, 2)
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 12
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2

  const ratio = canvas.width / canvas.height
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  const x = (pageW - w) / 2
  pdf.addImage(imgData, 'PNG', x, margin, w, h)

  const blob = pdf.output('blob')
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

  return saveDataUrl(dataUrl, `첨삭결과_${todayStamp()}.pdf`, 'pdf')
}
