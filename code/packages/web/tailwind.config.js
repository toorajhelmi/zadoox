/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // VS Code dark theme colors
        'vscode-bg': '#1e1e1e',
        'vscode-sidebar': '#252526',
        'vscode-active': '#37373d',
        'vscode-hover': '#2a2d2e',
        'vscode-border': '#3e3e42',
        'vscode-text': '#cccccc',
        'vscode-text-secondary': '#969696',
        'vscode-blue': '#007acc',
        'vscode-blue-hover': '#1a8cd8',
        'vscode-editor': '#1e1e1e',
        'vscode-input': '#3c3c3c',
        'vscode-input-border': '#454545',
        'vscode-sidebarBg': '#252526',
        'vscode-sidebarBorder': '#3e3e42',
        'vscode-statusBar-background': '#007acc',
        'vscode-statusBar-border': '#005a9e',
        'vscode-statusBar-foreground': '#ffffff',
        'vscode-buttonBg': '#0e639c',
        'vscode-buttonHoverBg': '#1177bb',
        'vscode-buttonText': '#ffffff',
      },
    },
    fontFamily: {
      // Override default fonts - VS Code exact font stack
      sans: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      serif: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      // AI vibe alternatives (if user has them installed)
      ai: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
    },
  },
  plugins: [],
};


