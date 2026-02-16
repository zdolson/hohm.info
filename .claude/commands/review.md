# review
Run a post-phase code review via sub-agent.

## Usage
`/review [scope]` — scope is file glob or description; defaults to current diff.

## Steps
1. Collect context:
   - `git diff HEAD` (or files matching `$ARGUMENTS`)
   - Any `CLAUDE.md` files in affected folders
2. Spawn sub-agent with role: **senior code reviewer, bullets only**.
3. Sub-agent reviews for:
   - **Correctness** — logic errors, edge cases, off-by-ones
   - **Security** — injections, unvalidated input, exposed secrets
   - **Performance** — N+1s, unnecessary re-renders, blocking ops
   - **Consistency** — deviates from local `CLAUDE.md` patterns?
   - **Gaps** — missing tests, missing error handling
4. Sub-agent output format:
   ```
   ## Critical
   - <issue> [file:line]
   ## Warnings
   - <issue> [file:line]
   ## Nits
   - <issue> [file:line]
   ## Approved
   yes/no
   ```
5. If Critical issues found: list them and halt — do not mark phase complete.
6. If Approved: confirm phase complete.
