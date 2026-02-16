# commit (update-and-commit)
Update colocated `CLAUDE.md` files for changed folders, then commit.

## Usage
`/commit [message]` — message optional; will be auto-generated if omitted.

## Steps
1. Run `git diff --name-only HEAD` to list changed files.
2. Group by parent folder. For each folder with changes:
   - Re-run `/gen-context <folder>` logic.
   - Stage updated `CLAUDE.md` if it changed.
3. Stage all intended changed files (do NOT `git add .` blindly).
4. Compose commit message:
   - Format: `<type>(<scope>): <imperative description>`
   - Types: feat | fix | refactor | chore | docs | test
   - Use `$ARGUMENTS` as message if provided, else generate.
5. `git commit -m "<message>"`. Do NOT push.
6. Output only: committed files list + final commit message.
