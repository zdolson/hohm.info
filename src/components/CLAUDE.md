# src/components

Park UI component library (Panda CSS recipes + Ark UI primitives).

## Files

- `ui/index.ts` — barrel export: Badge, Button, Card, Heading, Text, Icon, Link, Loader, Spinner, etc.
- `ui/*.tsx` — individual component wrappers using Panda CSS recipe styles from `@/theme/recipes`

## Patterns

- Components use `styled()` or recipe-based className approach from Panda CSS
- Import via `@/components/ui` barrel or `@/components/ui/card` for namespace imports
- Card uses namespace import pattern: `import * as Card from "@/components/ui/card"`
