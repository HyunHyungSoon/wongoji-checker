import { useRef, useState, useCallback, useMemo } from 'react'
import ManuscriptGrid from './components/ManuscriptGrid'
import { useDiff } from './hooks/useDiff'
import { exportPng, exportPdf } from './utils/export'

// In the Electron window the header needs left padding to clear the macOS
// traffic-light buttons; in the browser (shared web version) it doesn't.
const isElectron = typeof window !== 'undefined' && !!window.api

export default function App(): JSX.Element {
  const [original, setOriginal] = useState('')
  const [corrected, setCorrected] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [fluency, setFluency] = useState('')
  const [feedback, setFeedback] = useState('')
  const [toast, setToast] = useState<{ msg: string; kind: 'error' | 'ok' } | null>(
    null
  )
  const [exporting, setExporting] = useState(false)

  const glyphs = useDiff(original, corrected)
  const svgRef = useRef<SVGSVGElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const changeCount = useMemo(() => {
    let n = 0
    for (const g of glyphs) {
      if (!('type' in g)) continue
      if (
        g.type === 'deleted' ||
        g.type === 'replaced' ||
        g.type === 'spacing_add' ||
        g.type === 'spacing_remove'
      )
        n++
      // above-line insertions attach to a cell instead of being their own glyph
      if (g.insertBefore) n++
      if (g.insertAfter) n++
    }
    return n
  }, [glyphs])

  const showToast = useCallback(
    (msg: string, kind: 'error' | 'ok' = 'ok') => {
      setToast({ msg, kind })
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 4000)
    },
    []
  )

  const handleReset = (): void => {
    setOriginal('')
    setCorrected('')
    setAccuracy('')
    setFluency('')
    setFeedback('')
  }

  const copyOriginal = (): void => {
    // 수정 텍스트 칸을 원문으로 채워 시작점을 잡아주는 편의 기능
    setCorrected(original)
    showToast('원문을 수정 칸으로 복사했습니다.')
  }

  const doExport = async (kind: 'png' | 'pdf'): Promise<void> => {
    if (!svgRef.current) return
    setExporting(true)
    try {
      const res =
        kind === 'png'
          ? await exportPng(svgRef.current)
          : await exportPdf(svgRef.current)
      if (res.ok) showToast('저장되었습니다.')
      else if (!res.canceled) showToast('저장에 실패했습니다.', 'error')
    } catch {
      showToast('저장에 실패했습니다.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-panel font-kr text-gray-800">
      {/* Top toolbar */}
      <header
        className={`titlebar-drag flex h-12 items-center justify-between border-b border-gray-300 bg-white px-4 ${
          isElectron ? 'pl-20' : ''
        }`}
      >
        <h1 className="text-sm font-bold tracking-tight text-gray-800">
          원고지 첨삭 도우미
        </h1>
        <div className="no-drag flex items-center gap-2">
          <button
            onClick={() => doExport('png')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
          >
            이미지 저장
          </button>
          <button
            onClick={() => doExport('pdf')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
          >
            PDF 저장
          </button>
        </div>
      </header>

      {/* Main 3-panel area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — 원문 (검은색) */}
        <aside className="flex w-[260px] shrink-0 flex-col gap-3 border-r border-gray-300 bg-panel p-3">
          <label className="text-sm font-semibold text-gray-700">
            학생 원문 입력 <span className="text-gray-400">(검은색)</span>
          </label>
          <textarea
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="학생이 작성한 원문을 붙여넣으세요."
            className="flex-1 resize-none rounded-md border border-gray-300 bg-white p-2 text-sm leading-relaxed outline-none focus:border-primary"
          />
          <div className="text-xs text-gray-500">총 {original.length}자</div>
          <button
            onClick={copyOriginal}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            원문 → 수정 칸 복사
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            초기화
          </button>
        </aside>

        {/* Center panel — 원고지 결과 */}
        <main className="relative flex flex-1 flex-col overflow-auto bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            원고지 첨삭 결과
          </h2>
          <div className="flex justify-center">
            <div className="inline-block rounded-md bg-white p-3 shadow-sm">
              <ManuscriptGrid
                ref={svgRef}
                glyphs={glyphs}
                accuracy={accuracy}
                fluency={fluency}
                feedback={feedback}
              />
            </div>
          </div>

          {/* legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-600">
            <span>
              <span className="font-medium text-black">검은색</span> = 원문 그대로
            </span>
            <span>
              <span className="text-correction line-through">취소선</span> = 삭제
            </span>
            <span>
              <span className="font-semibold text-correction">빨간 글자</span> = 교체
            </span>
            <span>
              <span className="text-correction">∧</span> = 삽입
            </span>
            <span>
              <span className="text-correction">∨</span> = 띄어쓰기
            </span>
          </div>
        </main>

        {/* Right panel — 수정된 텍스트 (빨간색으로 표시됨) */}
        <aside className="flex w-[260px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-gray-300 bg-panel p-3">
          <label className="text-sm font-semibold text-gray-700">
            수정된 텍스트 입력{' '}
            <span className="text-correction">(빨간색 표시)</span>
          </label>
          <p className="text-xs text-gray-500">
            원문과 다른 부분이 원고지에 빨간색으로 표시됩니다.
          </p>
          <textarea
            value={corrected}
            onChange={(e) => setCorrected(e.target.value)}
            placeholder="수정된 텍스트를 입력하면 원고지에 즉시 반영됩니다."
            className="min-h-[160px] flex-1 resize-none rounded-md border border-gray-300 bg-white p-2 text-sm leading-relaxed text-gray-800 outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">총 {corrected.length}자</span>
            <span className="font-medium text-correction">
              수정 {changeCount}곳
            </span>
          </div>

          <div className="my-1 border-t border-gray-300" />

          <label className="text-sm font-semibold text-gray-700">평가</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="mb-1 block text-xs font-medium text-correction">
                정확성
              </span>
              <input
                value={accuracy}
                onChange={(e) => setAccuracy(e.target.value)}
                placeholder="예: 8/10"
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-correction outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <span className="mb-1 block text-xs font-medium text-correction">
                적절성
              </span>
              <input
                value={fluency}
                onChange={(e) => setFluency(e.target.value)}
                placeholder="예: 7/10"
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-correction outline-none focus:border-primary"
              />
            </div>
          </div>
          <span className="mt-1 block text-xs text-gray-500">피드백</span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="피드백 내용을 입력하면 원고지 아래에 표시됩니다."
            className="h-24 resize-none rounded-md border border-gray-300 bg-white p-2 text-sm leading-relaxed outline-none focus:border-primary"
          />
        </aside>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast.kind === 'ok' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Export overlay */}
      {exporting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white px-6 py-4 text-sm font-medium text-gray-700 shadow-xl">
            저장 중…
          </div>
        </div>
      )}
    </div>
  )
}
