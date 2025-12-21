# Documentation Workflow

## Quick Reference

### Normal Workflow (Recommended)

1. **Edit files** with `{CH}` placeholders:
   ```markdown
   # Chapter {CH} — Title
   ## {CH}.1 Section
   ```

2. **Commit your changes**:
   ```bash
   git add -A
   git commit -m "Your message"
   ```

3. **Push** - the git hook automatically:
   - Replaces `{CH}` with actual numbers
   - Amends your commit with the numbers
   - Pushes to remote (with actual numbers)
   - Restores `{CH}` placeholders in your local files
   ```bash
   git push origin main
   ```

**Result:**
- ✅ Git repository has actual numbers (for GitBook display)
- ✅ Your local files have `{CH}` placeholders (for easy editing)

### Generating LaTeX PDF

```bash
./docs/.scripts/build_latex.sh
```

This automatically:
- Creates temporary copies of your files
- Replaces `{CH}` with actual numbers in the copies
- Builds LaTeX from the copies
- Your source files remain unchanged with `{CH}` placeholders

### Renumbering Chapters

1. **Rename directories**:
   ```bash
   mv docs/content/chapter4 docs/content/chapter5
   ```

2. **Push normally** - numbers update automatically:
   ```bash
   git add -A
   git commit -m "Renumbered chapters"
   git push origin main
   ```

The hook will automatically update all chapter numbers based on directory names.

## What Happens During Push

When you run `git push`, the pre-push hook:

1. **Detects** if chapter files are being pushed
2. **Replaces** `{CH}` placeholders with actual numbers in your files
3. **Stages** the updated files
4. **Amends** your commit to include the numbers
5. **Restores** `{CH}` placeholders in your local working directory
6. **Continues** with the push (which now has actual numbers)

**Important:** The commit that gets pushed has actual numbers, but your local files are immediately restored to have `{CH}` placeholders.

## Manual Override

If you ever need to manually update numbers (not recommended):

```bash
# Replace placeholders with numbers
./docs/.scripts/update_chapter_numbers.sh

# Restore placeholders
./docs/.scripts/update_chapter_numbers.sh --restore
```

## Troubleshooting

**Problem:** Local files have actual numbers instead of placeholders
**Solution:**
```bash
./docs/.scripts/update_chapter_numbers.sh --restore
```

**Problem:** Git repo has placeholders instead of numbers
**Solution:** This shouldn't happen if hooks are working. Check that `.git/hooks/pre-push` exists and is executable.

**Problem:** Hook not running
**Solution:**
```bash
chmod +x .git/hooks/pre-push
# Or reinstall:
./docs/.scripts/setup_git_hooks.sh
```
