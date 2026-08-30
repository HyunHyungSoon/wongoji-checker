import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (next: string) => void
}

/**
 * Editable corrected-text area. Debounces (300ms) before propagating so the
 * grid re-diffs only after the teacher pauses typing.
 */
export default function TeacherEditor({ value, onChange }: Props): JSX.Element {
  const [local, setLocal] = useState(value)
  const [synced, setSynced] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // keep local in sync when the parent value changes externally (e.g. AI run)
  useEffect(() => {
    setLocal(value)
    setSynced(true)
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  const handle = (next: string): void => {
    setLocal(next)
    setSynced(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onChange(next)
      setSynced(true)
    }, 300)
  }

  return (
    <div className="flex h-full flex-col">
      <textarea
        value={local}
        onChange={(e) => handle(e.target.value)}
        placeholder="교정된 텍스트가 여기에 표시됩니다. 직접 수정하면 원고지에 반영됩니다."
        className="min-h-[140px] flex-1 resize-none rounded-md border border-gray-300 bg-white p-2 text-sm leading-relaxed text-gray-800 outline-none focus:border-primary"
      />
      <div className="mt-1.5 h-4 text-xs">
        {synced ? (
          <span className="font-medium text-green-600">✓ 원고지에 반영됨</span>
        ) : (
          <span className="text-gray-400">입력 중…</span>
        )}
      </div>
    </div>
  )
}
