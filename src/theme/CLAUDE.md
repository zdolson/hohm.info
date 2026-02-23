# src/theme

Panda CSS theme config: tokens, recipes, conditions, keyframes.

## Files

- `recipes/index.ts` — barrel: all recipes + slotRecipes for panda.config.ts
- `recipes/*.ts` — individual component recipes (badge, button, card, heading, text, etc.)
- `tokens/colors.ts` — custom color tokens (ruby accent)
- `tokens/shadows.ts`, `tokens/durations.ts`, `tokens/z-index.ts` — design tokens
- `conditions.ts` — custom Panda conditions
- `global-css.ts` — global CSS rules
- `keyframes.ts`, `animation-styles.ts`, `text-styles.ts`, `layer-styles.ts` — style extensions

## Patterns

- All exports consumed by `panda.config.ts` `theme.extend`
- Color palette: olive (gray) + ruby (accent) via @park-ui/panda-preset
- Semantic tokens: fg.default/muted/subtle, border, error
