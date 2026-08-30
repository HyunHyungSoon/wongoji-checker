import { forwardRef, useMemo } from 'react'
import type { Cell } from '../types'
import type { Glyph } from '../hooks/useDiff'

const CELL_W = 28
const CELL_H = 30
const COLS = 20
const HEADER_H = 46
// Interlinear space added ABOVE any row that carries an above-line insertion,
// so the inserted word has room and never collides with the row above.
const INSERT_BAND = 16
const FRAME_X = 16 // left padding inside svg
const FRAME_Y = 12 // top padding inside svg
const COUNT_GAP = 8
const COUNT_AREA = 34
const SCORE_W = 70 // width of each score box in the header
const FEEDBACK_GAP = 14 // gap between grid frame and feedback box
const FEEDBACK_CHARS = 44 // approx chars per feedback line
const FONT = "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"

const RED = '#cc0000'

/** Wrap feedback text to fit the grid width (Korean: wrap by character). */
function wrapFeedback(text: string): string[] {
  if (!text.trim()) return []
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('')
      continue
    }
    for (let i = 0; i < para.length; i += FEEDBACK_CHARS) {
      out.push(para.slice(i, i + FEEDBACK_CHARS))
    }
  }
  return out
}

interface LaidCell {
  cell: Cell
  r: number
  c: number
}

function isNewline(g: Glyph): g is { newline: true } {
  return (g as { newline?: true }).newline === true
}

/** Lay glyphs into rows of COLS, honoring paragraph indentation. */
function layout(glyphs: Glyph[]): { cells: LaidCell[]; rows: number } {
  const cells: LaidCell[] = []
  let r = 0
  let c = 0
  const indent = (): void => {
    // 1-cell paragraph indent
    cells.push({ cell: { char: '', type: 'empty' }, r, c })
    c = 1
  }

  // first paragraph indent
  indent()

  for (const g of glyphs) {
    if (isNewline(g)) {
      r += 1
      c = 0
      indent()
      continue
    }
    if (c >= COLS) {
      r += 1
      c = 0
    }
    cells.push({ cell: g, r, c })
    c += 1
  }

  const rows = Math.max(r + 1, 8) // minimum 8 rows for empty look
  return { cells, rows }
}

function countMarkers(cells: LaidCell[], rows: number): { r: number; n: number }[] {
  // cumulative count of written squares per row → 50-multiple markers
  const perRowEnd: number[] = new Array(rows).fill(0)
  let cum = 0
  // need cumulative by row order
  const maxRow = rows
  for (let row = 0; row < maxRow; row++) {
    for (const lc of cells) {
      if (lc.r !== row) continue
      if (lc.cell.type === 'empty' || lc.cell.type === 'spacing_add') continue
      cum += 1
    }
    perRowEnd[row] = cum
  }
  const markers: { r: number; n: number }[] = []
  let prev = 0
  for (let row = 0; row < maxRow; row++) {
    const end = perRowEnd[row]
    const prevMult = Math.floor(prev / 50)
    const endMult = Math.floor(end / 50)
    if (endMult > prevMult) {
      markers.push({ r: row, n: endMult * 50 })
    }
    prev = end
  }
  return markers
}

function CellGlyph({ cell, x, y }: { cell: Cell; x: number; y: number }): JSX.Element | null {
  if (!cell) return null
  const cx = x + CELL_W / 2
  const cy = y + CELL_H / 2

  const baseFont = {
    fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const
  }

  const punctX = cell.isPunct ? x + 8 : cx
  const punctY = cell.isPunct ? y + CELL_H - 9 : cy

  switch (cell.type) {
    case 'empty':
      return null

    case 'normal':
      return (
        <text
          x={cell.isPunct ? punctX : cx}
          y={cell.isPunct ? punctY : cy}
          fontSize={15}
          fill="#000000"
          {...baseFont}
        >
          {cell.char}
        </text>
      )

    case 'deleted':
      // The strikethrough is drawn separately (see strikeLines) so that a run
      // of consecutive deletions reads as one continuous line across cells.
      return (
        <text x={cx} y={cy} fontSize={15} fill={RED} {...baseFont}>
          {cell.char}
        </text>
      )

    case 'replaced':
      return (
        <g>
          <text
            x={cx}
            y={cy + 4}
            fontSize={13}
            fill={RED}
            style={{ textDecoration: 'line-through' }}
            {...baseFont}
          >
            {cell.char}
          </text>
          {cell.replacement && (
            <text
              x={cx}
              y={y + 7}
              fontSize={11}
              fontWeight={600}
              fill={RED}
              {...baseFont}
            >
              {cell.replacement}
            </text>
          )}
        </g>
      )

    case 'spacing_add':
      // 가운데(가로) · 위쪽(세로) 정렬
      return (
        <text x={cx} y={y + 8} fontSize={11} fill={RED} {...baseFont}>
          ∨
        </text>
      )

    case 'spacing_remove':
      // 붙여쓰기: red arc joining this and previous cell, at top
      return (
        <path
          d={`M ${x - 2} ${y + 5} Q ${cx} ${y - 4} ${x + CELL_W - 2} ${y + 5}`}
          stroke={RED}
          strokeWidth={1.2}
          fill="none"
        />
      )

    default:
      return null
  }
}

/**
 * Above-line insertion: a single caret ∧ at the insertion point on the baseline,
 * and the inserted text written as one word in the interlinear band above.
 * `side` = 'before' → caret at the cell's left edge; 'after' → right edge.
 */
function InsertionMark({
  text,
  x,
  yTop,
  side
}: {
  text: string
  x: number
  yTop: number
  side: 'before' | 'after'
}): JSX.Element {
  const gridW = COLS * CELL_W
  const caretX = side === 'before' ? Math.max(2, x) : Math.min(gridW - 2, x + CELL_W)
  const fontSize = 11
  // Center the word over the caret, then clamp inside the grid width.
  const approxW = text.length * fontSize * 1.0
  let startX = caretX - approxW / 2
  if (startX < 1) startX = 1
  if (startX + approxW > gridW - 1) startX = Math.max(1, gridW - 1 - approxW)
  const baseFont = {
    fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
    dominantBaseline: 'central' as const
  }
  return (
    <g>
      {/* inserted word, in the interlinear band above the row */}
      <text
        x={startX}
        y={yTop - INSERT_BAND / 2 - 1}
        fontSize={fontSize}
        fontWeight={600}
        fill={RED}
        textAnchor="start"
        {...baseFont}
      >
        {text}
      </text>
      {/* caret at the insertion point, tip on the top grid line */}
      <text
        x={caretX}
        y={yTop + 1}
        fontSize={11}
        fill={RED}
        textAnchor="middle"
        {...baseFont}
      >
        ∧
      </text>
    </g>
  )
}

interface Props {
  glyphs: Glyph[]
  accuracy?: string
  fluency?: string
  feedback?: string
}

const ManuscriptGrid = forwardRef<SVGSVGElement, Props>(
  ({ glyphs, accuracy = '', fluency = '', feedback = '' }, ref) => {
  const { cells, rows } = useMemo(() => layout(glyphs), [glyphs])
  const markers = useMemo(() => countMarkers(cells, rows), [cells, rows])
  const feedbackLines = useMemo(() => wrapFeedback(feedback), [feedback])

  const gridW = COLS * CELL_W

  // Rows that carry an above-line insertion get an interlinear band above them.
  // rowTop[r] is the y of the top edge of row r's squares (band already added).
  const { rowTop, gridH } = useMemo(() => {
    const hasInsert = new Array(rows).fill(false)
    for (const lc of cells) {
      if (lc.cell.insertBefore || lc.cell.insertAfter) hasInsert[lc.r] = true
    }
    const tops = new Array<number>(rows)
    let y = 0
    for (let r = 0; r < rows; r++) {
      if (hasInsert[r]) y += INSERT_BAND
      tops[r] = y
      y += CELL_H
    }
    return { rowTop: tops, gridH: y }
  }, [cells, rows])

  const cellTop = (r: number): number => rowTop[r] ?? r * CELL_H

  const frameW = gridW
  const frameH = HEADER_H + gridH
  const feedbackH = Math.max(56, 30 + feedbackLines.length * 18)
  const svgW = FRAME_X * 2 + frameW + COUNT_GAP + COUNT_AREA
  const svgH = FRAME_Y * 2 + frameH + FEEDBACK_GAP + feedbackH

  // vertical inner lines — drawn per row square so they don't cross the
  // interlinear bands (keeping the inserted word above the line unobscured)
  const vLines = []
  for (let r = 0; r < rows; r++) {
    const yt = cellTop(r)
    for (let c = 1; c < COLS; c++) {
      const x = c * CELL_W
      vLines.push(
        <line
          key={`v${r}-${c}`}
          x1={x}
          y1={yt}
          x2={x}
          y2={yt + CELL_H}
          stroke="#aaaaaa"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )
    }
  }
  // horizontal square edges (top + bottom of each row). Rows with a band show a
  // gap between the previous square's bottom and this square's top.
  const hLines = []
  for (let r = 0; r < rows; r++) {
    const top = cellTop(r)
    const bottom = top + CELL_H
    for (const [pos, y] of [
      ['top', top],
      ['bottom', bottom]
    ] as const) {
      if (y <= 0 || y >= gridH) continue // outer frame draws the extremes
      const isGroup = pos === 'top' && r % 2 === 0
      hLines.push(
        <line
          key={`h${r}-${pos}`}
          x1={0}
          y1={y}
          x2={gridW}
          y2={y}
          stroke={isGroup ? '#888888' : '#aaaaaa'}
          strokeWidth={1}
          strokeDasharray={isGroup ? undefined : '3 3'}
        />
      )
    }
  }

  // Above-line insertion marks (caret + inserted word).
  const insertMarks: JSX.Element[] = []
  for (const lc of cells) {
    const x = lc.c * CELL_W
    const yt = cellTop(lc.r)
    if (lc.cell.insertBefore) {
      insertMarks.push(
        <InsertionMark key={`ib-${lc.r}-${lc.c}`} text={lc.cell.insertBefore} x={x} yTop={yt} side="before" />
      )
    }
    if (lc.cell.insertAfter) {
      insertMarks.push(
        <InsertionMark key={`ia-${lc.r}-${lc.c}`} text={lc.cell.insertAfter} x={x} yTop={yt} side="after" />
      )
    }
  }

  // Continuous strikethrough over runs of adjacent deleted cells. A run breaks
  // at a row wrap (and continues on the next row) or at any non-deleted cell.
  const strikeLines: JSX.Element[] = []
  {
    const ordered = [...cells].sort((a, b) => a.r - b.r || a.c - b.c)
    let i = 0
    while (i < ordered.length) {
      if (ordered[i].cell.type !== 'deleted') {
        i++
        continue
      }
      let j = i
      while (
        j + 1 < ordered.length &&
        ordered[j + 1].cell.type === 'deleted' &&
        ordered[j + 1].r === ordered[j].r &&
        ordered[j + 1].c === ordered[j].c + 1
      ) {
        j++
      }
      const first = ordered[i]
      const last = ordered[j]
      const y = cellTop(first.r) + CELL_H / 2
      strikeLines.push(
        <line
          key={`sl-${first.r}-${first.c}`}
          x1={first.c * CELL_W + 3}
          y1={y}
          x2={last.c * CELL_W + CELL_W - 3}
          y2={y}
          stroke={RED}
          strokeWidth={1.4}
        />
      )
      i = j + 1
    }
  }

  return (
    <svg
      ref={ref}
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#ffffff' }}
    >
      <rect x={0} y={0} width={svgW} height={svgH} fill="#ffffff" />

      {/* outer frame (header + grid) */}
      <g transform={`translate(${FRAME_X}, ${FRAME_Y})`}>
        <rect
          x={0}
          y={0}
          width={frameW}
          height={frameH}
          fill="none"
          stroke="#000000"
          strokeWidth={1.5}
        />

        {/* header */}
        <g>
          {/* 정확성 / 유창성 score boxes (top-left) */}
          {[
            { label: '정확성', value: accuracy, x: 0 },
            { label: '적절성', value: fluency, x: SCORE_W }
          ].map((s) => (
            <g key={s.label}>
              <rect
                x={s.x}
                y={0}
                width={SCORE_W}
                height={HEADER_H}
                fill="none"
                stroke="#000000"
                strokeWidth={0.8}
              />
              <text
                x={s.x + SCORE_W / 2}
                y={14}
                fontSize={10}
                fill={RED}
                textAnchor="middle"
                fontFamily={FONT}
              >
                {s.label}
              </text>
              <text
                x={s.x + SCORE_W / 2}
                y={33}
                fontSize={15}
                fontWeight={600}
                fill={RED}
                textAnchor="middle"
                fontFamily={FONT}
              >
                {s.value}
              </text>
            </g>
          ))}
          {/* title (centered over the area right of the score boxes) */}
          <text
            x={SCORE_W * 2 + (frameW - SCORE_W * 2) / 2}
            y={18}
            fontSize={15}
            fontWeight={700}
            fill="#000000"
            textAnchor="middle"
            letterSpacing={6}
            fontFamily={FONT}
          >
            주 관 식 답 란
          </text>
          <text
            x={SCORE_W * 2 + (frameW - SCORE_W * 2) / 2}
            y={35}
            fontSize={10}
            fill="#444444"
            textAnchor="middle"
            fontFamily={FONT}
          >
            ※ 한 칸에 한 글자씩 쓰십시오. (띄어쓰기 포함)
          </text>
          {/* header divider */}
          <line
            x1={0}
            y1={HEADER_H}
            x2={frameW}
            y2={HEADER_H}
            stroke="#000000"
            strokeWidth={0.8}
          />
        </g>

        {/* grid */}
        <g transform={`translate(0, ${HEADER_H})`}>
          {hLines}
          {vLines}
          {cells.map((lc, i) => (
            <CellGlyph key={i} cell={lc.cell} x={lc.c * CELL_W} y={cellTop(lc.r)} />
          ))}
          {strikeLines}
          {insertMarks}
        </g>

        {/* count markers on the right, outside the frame */}
        {markers.map((m) => (
          <text
            key={m.n}
            x={frameW + COUNT_GAP + COUNT_AREA - 4}
            y={HEADER_H + cellTop(m.r) + CELL_H}
            fontSize={11}
            fill="#444444"
            textAnchor="end"
            dominantBaseline="central"
            fontFamily="'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"
          >
            {m.n}
          </text>
        ))}

        {/* feedback box below the grid */}
        <g transform={`translate(0, ${frameH + FEEDBACK_GAP})`}>
          <rect
            x={0}
            y={0}
            width={frameW}
            height={feedbackH}
            fill="none"
            stroke="#000000"
            strokeWidth={1.5}
          />
          <text
            x={8}
            y={18}
            fontSize={12}
            fontWeight={700}
            fill="#000000"
            fontFamily={FONT}
          >
            피드백
          </text>
          {feedbackLines.map((ln, i) => (
            <text
              key={i}
              x={8}
              y={36 + i * 18}
              fontSize={12}
              fill="#000000"
              fontFamily={FONT}
            >
              {ln}
            </text>
          ))}
        </g>
      </g>
    </svg>
  )
})

ManuscriptGrid.displayName = 'ManuscriptGrid'
export default ManuscriptGrid
