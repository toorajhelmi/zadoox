export type GridMarginPreset = 'small' | 'medium' | 'large';

export type GridSpacingPreset = {
  /** Outer padding around the grid container (preview + editor). */
  outerPadPx: number;
  /** Outer margin above/below the grid widget (editor). */
  outerMarginPx: number;
  /** Gap between cells in editor (non-borderMode). */
  gapPx: number;
  /** Padding inside each cell (editor, non-borderMode). */
  cellPadPx: number;
  /** Extra padding inside figure cards when rendered inside grids (editor). */
  cardPadPx: number;
  /** Space below caption (editor). */
  captionBottomPx: number;
  /** Preview: table cell padding */
  previewCellPadX: number;
  previewCellPadY: number;
  /** LaTeX: spacing knobs */
  latexFigureGridGutter: number;
  latexFigureGridRowVspace: string; // e.g. "0.75em"
  latexTabcolsepPt: number; // affects horizontal padding in tabular/tabularx
  latexArraystretch: number; // affects vertical padding in tables
};

export const GRID_SPACING_PRESETS: Record<GridMarginPreset, GridSpacingPreset> = {
  small: {
    // Small should feel as tight as possible.
    outerPadPx: 2,
    outerMarginPx: 2,
    gapPx: 0,
    cellPadPx: 0,
    cardPadPx: 0,
    captionBottomPx: 2,
    previewCellPadX: 0,
    previewCellPadY: 0,
    latexFigureGridGutter: 0.01,
    latexFigureGridRowVspace: '0.25em',
    latexTabcolsepPt: 3,
    latexArraystretch: 1.0,
  },
  medium: {
    outerPadPx: 10,
    outerMarginPx: 6,
    gapPx: 10,
    cellPadPx: 6,
    cardPadPx: 6,
    captionBottomPx: 8,
    previewCellPadX: 8,
    previewCellPadY: 6,
    latexFigureGridGutter: 0.02,
    latexFigureGridRowVspace: '0.75em',
    latexTabcolsepPt: 6,
    latexArraystretch: 1.1,
  },
  large: {
    outerPadPx: 14,
    outerMarginPx: 10,
    gapPx: 14,
    cellPadPx: 10,
    cardPadPx: 10,
    captionBottomPx: 12,
    previewCellPadX: 12,
    previewCellPadY: 10,
    latexFigureGridGutter: 0.05,
    latexFigureGridRowVspace: '1.5em',
    latexTabcolsepPt: 9,
    latexArraystretch: 1.25,
  },
};

export function normalizeGridMargin(raw: unknown): GridMarginPreset {
  const m = String(raw ?? '').trim().toLowerCase();
  if (m === 'small' || m === 's' || m === 'sm') return 'small';
  if (m === 'large' || m === 'l' || m === 'lg') return 'large';
  return 'medium';
}

export function getGridSpacingPreset(margin: unknown): GridSpacingPreset {
  return GRID_SPACING_PRESETS[normalizeGridMargin(margin)];
}


