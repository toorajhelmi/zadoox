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
      },
      fontFamily: {
        mono: ['"Consolas"', '"Monaco"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};


