export type CorrectionType =
  | 'spelling'
  | 'spacing'
  | 'grammar'
  | 'vocabulary'
  | 'delete'
  | 'insert'

export interface Correction {
  type: CorrectionType
  original: string
  corrected: string
  reason: string
}

export interface ProofreadResult {
  corrected: string
  corrections: Correction[]
}

export type CellType =
  | 'normal'
  | 'deleted'
  | 'replaced'
  | 'inserted'
  | 'empty'
  | 'spacing_add'
  | 'spacing_remove'

export interface Cell {
  /** primary character shown in the cell ('' for empty) */
  char: string
  type: CellType
  /** for replaced cells: the new (corrected) character drawn in red */
  replacement?: string
  /** punctuation rendered bottom-left */
  isPunct?: boolean
  /**
   * Inserted text to render above the line, just BEFORE this cell (a single
   * caret ∧ sits at this cell's left edge). Multi-character insertions read as
   * one word instead of one caret per square.
   */
  insertBefore?: string
  /** Inserted text above the line, just AFTER this cell (caret at right edge). */
  insertAfter?: string
}
