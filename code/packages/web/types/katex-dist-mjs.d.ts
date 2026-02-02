declare module 'katex/dist/katex.mjs' {
  // KaTeX ships types for `katex` (CJS entry), but the ESM bundle path does not
  // always have a corresponding .d.ts in node_modules. We only use `render` and
  // `renderToString`, so keep this minimal.
  const katex: {
    render?: (tex: string, element: HTMLElement, options?: unknown) => void;
    renderToString?: (tex: string, options?: unknown) => string;
  };
  export default katex;
}


