# Branch Protection Setup Guide

## Setting Up Branch Protection for `main`

Since we can't configure branch protection via API easily, follow these steps in the GitHub UI:

### Steps:

1. **Go to Repository Settings**
   - Navigate to: https://github.com/toorajhelmi/zadoox/settings
   - Click on "Branches" in the left sidebar

2. **Add Branch Protection Rule**
   - Click "Add branch protection rule"
   - Branch name pattern: `main`

3. **Configure Protection Settings**

   ✅ **Protect matching branches**
   
   ✅ **Require a pull request before merging**
   - ✅ Require approvals: 1 (or more if you want)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners (if you set up CODEOWNERS file)

   ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - ✅ Status checks that are required:
     - `build-and-test` (from CI workflow)

   ✅ **Require conversation resolution before merging** (optional but recommended)

   ✅ **Do not allow bypassing the above settings** (recommended)
   - Or uncheck to allow admins to bypass (your choice)

4. **Save the Rule**
   - Click "Create" or "Save changes"

### What This Means:

- ✅ No direct pushes to `main` branch
- ✅ All changes must go through PRs
- ✅ CI checks must pass before merging
- ✅ PR reviews required before merging
- ✅ Branches must be up to date with `main` before merging

### Testing the Setup:

1. Try to push directly to `main`:
   ```bash
   git checkout main
   git push origin main
   ```
   Should fail with a protection error.

2. Create a test branch and PR:
   ```bash
   git checkout -b test/branch-protection
   git commit --allow-empty -m "test: Test branch protection"
   git push origin test/branch-protection
   ```
   Then create a PR and verify that:
   - CI checks run
   - You can't merge until checks pass
   - Reviews are required (if configured)

