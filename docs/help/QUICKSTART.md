# Quick Start Guide

Get started with **Zadoox** in 5 minutes!

## Step 1: Copy Zadoox to Your Project

```bash
# Copy Zadoox to your new project directory
cp -r /path/to/Zadoox/* /path/to/your-new-project/
cd /path/to/your-new-project/
```

## Step 2: Initialize

```bash
./init_template.sh "My Awesome Project" "John Doe"
```

This will:
- Update project name and author in LaTeX files
- Make scripts executable
- Set up git hooks (if git is initialized)
- Create a `.gitignore` file

## Step 3: Start Writing

1. Edit `docs/content/README.md` - Add your abstract
2. Edit `docs/content/chapter1/README.md` - Start your first chapter
3. Use `{CH}` placeholders for chapter numbers (they auto-update!)

Example:
```markdown
# Chapter {CH} — Introduction
## {CH}.1 Background
### {CH}.1.1 Motivation
```

## Step 4: Build PDF

```bash
./docs/.scripts/build_latex.sh
```

Your PDF will be at: `docs/_build/latex/main.pdf`

## Step 5: Add More Chapters

1. Create directory: `docs/content/chapter2/`
2. Add `README.md` with your content
3. Update `docs/latex/main.tex` to include:
   ```latex
   \input{chapters/chapter2/README}
   \newpage
   ```

## That's It!

- **Edit** with `{CH}` placeholders
- **Push** to git (numbers auto-update)
- **Build** PDF anytime with the script

## Next Steps

- Read `README.md` for full documentation
- Read `WORKFLOW.md` for detailed workflow
- Read `CHAPTER_NUMBERING.md` for numbering system details

