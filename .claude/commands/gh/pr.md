---
description: Create a GitHub PR with auto-generated semantic description from recent commits
allowed_tools: [Bash, Read, Write]
---

You are a code reviewer and release coordinator. Your task is to create a well-structured pull request on GitHub with a semantic description that clearly communicates the changes, context, and testing requirements. The PR should be ready for review immediately after creation.

## Input Format

`$ARGUMENTS` is an optional, brief user-provided hint for the PR title or summary (e.g., `"add login form validation"`, `"fix token refresh bug"`). If not provided, the title will be inferred from the most descriptive recent commit.

## Process

1. **Determine the base branch**: Run `git fetch origin` and then detect the base branch (see step 2).

2. **Detect the base branch**: Use `release/*` branch detection with fallback:

   ```bash
   git fetch origin
   BASE=$(git branch -r | grep 'origin/release/' | sed 's|.*origin/||' | sort -V | tail -1)
   if [ -z "$BASE" ]; then
     BASE=$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name')
   fi
   echo "Base branch: $BASE"
   ```

   After determining `$BASE`, inspect current state:

   ```bash
   git status
   git log origin/$BASE..HEAD --oneline
   git diff origin/$BASE..HEAD --stat
   ```

3. **Infer PR title**:
   - If `$ARGUMENTS` is provided, use it as the hint for the PR title
   - Otherwise, analyze the most descriptive recent commit (the one that captures the intent of all changes)
   - Title must be a readable English sentence in title case with no prefixes
   - Must be synthesized from the intent of the changes — not lifted from any commit message
   - Keep ≤72 characters and imperative mood
   - Examples: `Add login form validation`, `Fix token refresh bug on expiry`, `Install testing dependencies`

4. **Draft the PR body** using this semantic template:

   ```
   ## Summary
   [One paragraph explaining the purpose and value of this PR]

   ## Changes
   - [Change 1]
   - [Change 2]
   - [Change 3]

   ## Checklists
   - [] [Checklist 1]
   - [] [Checklist 2]
   - [] [Checklist 3]

   ## Test Plan
   [Steps to verify the changes work as intended, or "N/A" if no manual testing needed]
   ```

5. **Populate the template**:
   - **Summary**: Read recent commits and the stat diff. Write one clear paragraph explaining why these changes were made
   - **Changes**: Extract 3–5 meaningful bullet points from the commits and diff (focus on what changed, not file names)
   - **Type of Change**: Check the boxes that apply based on commit types (feat → Feature, fix → Bug fix, etc.)
   - **Test Plan**: Infer from the changes what a reviewer should test. If it's a chore/docs-only PR, write "N/A"
   - **Assignee**: Always set to `danbileee` (the project author)
   - **Base branch**: Prefer the latest `release/*` remote branch; fall back to the repo default branch if none exists
   - **Ensure commits exist**: If the current branch has no commits ahead of the base, inform the user and stop

6. **Present and confirm**: Display the proposed PR title and body to the user in a clear format. Wait for confirmation before proceeding (the user should have a chance to edit the title or body).

7. **Execute**: Once confirmed, run:

   ```bash
   gh pr create --base "$BASE" --title "<title>" --body "<body>" --reviewer danbileee
   ```

8. **Output the result**: Display the PR URL from the command output so the user can open it in their browser.
