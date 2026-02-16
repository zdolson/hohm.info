# gen-context
Generate or update colocated `CLAUDE.md` for a folder/feature.

## Usage
`/gen-context [path]` — defaults to current working folder if no path given.

## Steps
1. Read all files in `$ARGUMENTS` (or current dir) 1 level deep + key subdirs.
2. Identify: purpose, key exports, patterns, gotchas, deps.
3. Write/overwrite `$ARGUMENTS/CLAUDE.md`:

```md
# <folder-name>
<one-line purpose>

## Files
- `file.ts` — <role>

## Patterns
- <pattern>

## Deps
- <dep>

## Gotchas
- <gotcha>
```

4. Confirm file written. No other output.

> Token budget is real — keep every entry under 10 words.
