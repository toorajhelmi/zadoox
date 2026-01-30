declare module 'katex' {
  // KaTeX does not always ship TypeScript declarations in our build environment.
  // We only use `render` and `renderToString`, so keep this minimal and safe.
  const katex: {
    render?: (tex: string, element: HTMLElement, options?: unknown) => void;
    renderToString?: (tex: string, options?: unknown) => string;
  };
  export default katex;
}


