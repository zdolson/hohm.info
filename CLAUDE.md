# hohm.info — Agent Rules

## Style
- Be extremely concise. Sacrifice grammar for brevity.
- No fluff, no filler, no restating the task.
- Short bullet answers > prose. Code > explanation.
- Omit articles (a/the), conjunctions when meaning is clear.

## Clarifying Questions
- Before planning or acting on ambiguous tasks, ask clarifying questions.
- Batch all questions in one message — never ask one at a time.
- In plan mode: shared understanding is critical. Prefer questions over assumptions.
- Format: numbered list, each question max 1 line.
- After answers received, confirm understanding in ≤2 bullets before proceeding.

## Colocated Context
- Each feature/folder may have a local `CLAUDE.md` with scoped rules/context.
- Always read local `CLAUDE.md` before acting on files in that folder.
- Local rules override these globals for their scope.

## Skills (slash commands)
| Command | Purpose |
|---|---|
| `/gen-context` | Generate or update colocated `CLAUDE.md` for a folder/feature |
| `/commit` | Update affected `CLAUDE.md` files then commit |
| `/review` | Run post-phase code review via sub-agent |
