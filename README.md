# Zadoox

**Zadoox** — Transform your thoughts and ideas into elegant code and documentation.

A powerful template for creating professional documents that can produce both LaTeX PDFs and Markdown (for GitBook, GitHub, etc.) while seamlessly accompanying code projects. Perfect for academic research, industry documentation, and any project that needs both beautiful documentation and clean code.

## Features

- **Dual Output**: Generate both LaTeX PDFs and Markdown documentation
- **Chapter Numbering**: Automatic chapter numbering with `{CH}` placeholders
- **Git Integration**: Automatic number replacement on push, restoration on pull
- **Code Integration**: Easy integration with code projects
- **Flexible Structure**: Organize content by chapters with assets support

## Quick Start

1. **Copy Zadoox** to your project:
   ```bash
   cp -r Zadoox/ your-project/
   cd your-project/
   ```

2. **Initialize Zadoox**:
   ```bash
   ./init_template.sh "Your Project Name" "Your Name"
   ```

3. **Start writing**:
   - Edit files in `docs/content/chapter*/README.md`
   - Use `{CH}` placeholders for chapter numbers
   - Add images to `docs/content/assets/`

4. **Build LaTeX PDF**:
   ```bash
   ./docs/.scripts/build_latex.sh
   ```

5. **Push to git** (numbers auto-update):
   ```bash
   git add -A
   git commit -m "Your changes"
   git push
   ```

## Directory Structure

```
Zadoox/
├── init_template.sh          # Initialization script
├── README.md                 # This file
├── QUICKSTART.md            # Quick start guide
├── WORKFLOW.md              # Detailed workflow documentation
├── CHAPTER_NUMBERING.md     # Chapter numbering system docs
├── docs/
│   ├── .scripts/            # Build and automation scripts
│   │   ├── build_latex.sh   # Build LaTeX PDF from Markdown
│   │   ├── update_chapter_numbers.sh  # Replace/restore {CH} placeholders
│   │   └── setup_git_hooks.sh  # Install git hooks
│   ├── content/             # Source Markdown content
│   │   ├── chapter1/        # Example chapter directories
│   │   ├── assets/          # Images and figures
│   │   ├── README.md        # Main document (abstract, etc.)
│   │   └── SUMMARY.md       # Optional summary
│   └── latex/               # LaTeX template files
│       ├── main.tex         # Main LaTeX document
│       ├── preamble.tex     # LaTeX packages and config
│       └── bibliography.bib # Bibliography template
```

## Chapter Numbering System

Use `{CH}` placeholders in your Markdown files:

```markdown
# Chapter {CH} — Title
## {CH}.1 Section
### {CH}.1.1 Subsection
Figure {CH}.1 — Description
```

The `{CH}` is automatically replaced with the actual chapter number based on the directory name (e.g., `chapter4/` → `4`).

## Requirements

- **LaTeX**: Full LaTeX distribution (TeX Live, MacTeX, etc.)
- **pandoc**: For Markdown to LaTeX conversion
- **bash**: For scripts (Unix/Linux/macOS)

Install pandoc:
```bash
# macOS
brew install pandoc

# Linux
sudo apt-get install pandoc

# Or download from: https://pandoc.org/installing.html
```

## License

Zadoox is provided as-is. Customize freely for your projects.

---

**Zadoox** — Transform your thoughts and ideas into elegant code and documentation.  
Visit [zadoox.com](https://zadoox.com) for more information.

