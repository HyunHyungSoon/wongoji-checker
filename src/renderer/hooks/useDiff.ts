import { useMemo } from 'react'
import DiffMatchPatch from 'diff-match-patch'
import type { Cell } from '../types'

export type Glyph = Cell | { newline: true }

const PUNCT = new Set(['.', ',', '。', '，', '、', '!', '?', '！', '？', '·'])

function isPunct(ch: string): boolean {
  return PUNCT.has(ch)
}

// 원고지 관례: 마침표·쉼표류 뒤의 띄어쓰기는 새 칸을 만들지 않고 바로 이어 쓴다.
// (물음표·느낌표 뒤는 한 칸을 띄우는 관례라 제외한다.)
const NO_SPACE_AFTER = new Set(['.', ',', '·', '。', '，', '、'])

const dmp = new DiffMatchPatch.diff_match_patch()

/**
 * Build the flat glyph stream for the manuscript grid by diffing the original
 * student text against the (AI- or teacher-) corrected text at character level.
 *
 * Pairing rule: a run of deletions immediately followed by a run of insertions
 * is zipped into "replaced" cells. Leftover deletions render as struck-through
 * red cells. Whitespace changes become spacing marks.
 *
 * Character insertions do NOT occupy grid squares. Instead they attach to the
 * next real cell as `insertBefore` (or the previous cell as `insertAfter` at a
 * line/text end) and are drawn as one word above the line, with a single caret
 * ∧ at the insertion point. This keeps multi-character insertions readable
 * ("그리고" as one word) instead of one caret per square.
 */
export function buildGlyphs(original: string, corrected: string): Glyph[] {
  const diffs = dmp.diff_main(original, corrected)
  dmp.diff_cleanupSemantic(diffs)

  // Flatten into per-char ops: 0 = equal, -1 = delete, 1 = insert
  type Op = { op: -1 | 0 | 1; ch: string }
  const ops: Op[] = []
  for (const [type, text] of diffs) {
    for (const ch of text) ops.push({ op: type as -1 | 0 | 1, ch })
  }

  const glyphs: Glyph[] = []
  let pendingIns = '' // inserted text waiting to attach to the next real cell

  const isNL = (g: Glyph): boolean => (g as { newline?: true }).newline === true

  // Emit a real (square-occupying) cell, flushing any pending insertion onto it.
  const emitCell = (cell: Cell): void => {
    if (pendingIns) {
      cell.insertBefore = pendingIns
      pendingIns = ''
    }
    glyphs.push(cell)
  }

  // A line/text end can't attach the insertion to a following cell, so hang it
  // off the last real cell as `insertAfter`.
  const flushInsAfter = (): void => {
    if (!pendingIns) return
    for (let j = glyphs.length - 1; j >= 0; j--) {
      const g = glyphs[j]
      if (!isNL(g)) {
        const c = g as Cell
        c.insertAfter = (c.insertAfter ?? '') + pendingIns
        pendingIns = ''
        return
      }
    }
    // No preceding cell at all (insertion into empty text): anchor it.
    glyphs.push({ char: '', type: 'empty', insertAfter: pendingIns })
    pendingIns = ''
  }

  const emitNewline = (): void => {
    flushInsAfter()
    glyphs.push({ newline: true })
  }

  const lastRealCell = (): Cell | null => {
    for (let j = glyphs.length - 1; j >= 0; j--) {
      if (!isNL(glyphs[j])) return glyphs[j] as Cell
    }
    return null
  }

  // A run of inserted characters. Split on newlines; a segment that is only
  // whitespace becomes ∨ spacing marks, otherwise it's above-line insert text.
  const handleInsertionRun = (text: string): void => {
    const segments = text.split('\n')
    segments.forEach((seg, idx) => {
      if (idx > 0) emitNewline()
      if (seg === '') return
      if (seg.trim() === '') {
        // pure space insertion → 띄어쓰기 mark(s), one per space
        for (let s = 0; s < seg.length; s++) {
          emitCell({ char: '', type: 'spacing_add' })
        }
      } else {
        // trim only the ends — a word-boundary space shouldn't shift the
        // above-line word, but keep spaces between multiple inserted words
        pendingIns += seg.replace(/^ +| +$/g, '')
      }
    })
  }

  let i = 0
  while (i < ops.length) {
    const cur = ops[i]

    if (cur.op === 0) {
      if (cur.ch === '\n') emitNewline()
      else if (cur.ch === ' ' && NO_SPACE_AFTER.has(lastRealCell()?.char ?? '')) {
        // 마침표·쉼표 뒤의 띄어쓰기는 칸을 만들지 않는다
      } else emitCell({ char: cur.ch, isPunct: isPunct(cur.ch), type: 'normal' })
      i++
      continue
    }

    if (cur.op === -1) {
      // collect deletion run
      const del: string[] = []
      while (i < ops.length && ops[i].op === -1) del.push(ops[i++].ch)
      // collect following insertion run (if any) for pairing
      const ins: string[] = []
      while (i < ops.length && ops[i].op === 1) ins.push(ops[i++].ch)

      const paired = Math.min(del.length, ins.length)
      for (let k = 0; k < paired; k++) {
        const d = del[k]
        const a = ins[k]
        if (d === '\n') {
          emitNewline()
        } else if (d === ' ' && a !== ' ') {
          if (a === '\n') emitNewline()
          else emitCell({ char: a, isPunct: isPunct(a), type: 'normal' })
        } else {
          emitCell({
            char: d,
            type: 'replaced',
            replacement: a === ' ' ? '' : a,
            isPunct: isPunct(a)
          })
        }
      }
      // leftover deletions
      for (let k = paired; k < del.length; k++) {
        const d = del[k]
        if (d === '\n') emitNewline()
        else if (d === ' ') emitCell({ char: ' ', type: 'spacing_remove' })
        else emitCell({ char: d, type: 'deleted', isPunct: isPunct(d) })
      }
      // leftover insertions → above-line insert text
      if (ins.length > paired) handleInsertionRun(ins.slice(paired).join(''))
      continue
    }

    // cur.op === 1 (insertion not preceded by deletion)
    const ins: string[] = []
    while (i < ops.length && ops[i].op === 1) ins.push(ops[i++].ch)
    handleInsertionRun(ins.join(''))
  }

  flushInsAfter() // trailing insertion at end of text
  return glyphs
}

export function useDiff(original: string, corrected: string): Glyph[] {
  return useMemo(
    () => buildGlyphs(original, corrected),
    [original, corrected]
  )
}
