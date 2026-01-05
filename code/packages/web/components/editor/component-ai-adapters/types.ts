export type EmbeddedComponentKind = 'figure' | 'grid';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ComponentContext =
  | {
      kind: 'figure';
      figure: { caption: string; src: string; attrs: string } | { raw: string };
      conversation: ChatMessage[];
    }
  | {
      kind: 'grid';
      grid: {
        header: string;
        figuresCount: number;
        figures: Array<{ index: number; caption: string; src: string; attrs: string }>;
      };
      conversation: ChatMessage[];
    };

export type ComponentEditCapabilities = {
  /**
   * Whether the model is allowed to change image src/urls.
   * Defaults to false.
   */
  allowSrcChange?: boolean;
  /**
   * Whether the model is allowed to remove elements (e.g. delete an image from a grid).
   * Defaults to true for now.
   */
  allowRemove?: boolean;
  /**
   * Allowed editable fields for figure-level attrs.
   */
  allowedFigureAttrs?: Array<'width' | 'align' | 'placement' | 'desc'>;
  /**
   * Allowed editable fields for container/header attrs (e.g. grid/table header).
   */
  allowedContainerAttrs?: string[];
  /**
   * Output constraints for the model. These are adapter/IR-defined, and help keep updatedXmd parseable.
   */
  output?: {
    shape?: 'singleFigureLine' | 'fencedGridBlock';
  };
};

export type ComponentEditResult =
  | { type: 'clarify'; question: string; suggestions?: string[]; model?: string }
  | { type: 'update'; updatedXmd: string; summary: string; confirmationQuestion?: string; model?: string };


