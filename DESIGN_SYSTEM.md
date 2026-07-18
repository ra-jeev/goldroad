# Gold Road Design System

This document describes the centralized design system implemented in `app/assets/css/main.css`.

## Overview

The design system uses CSS custom properties in `app/assets/css/main.css` to maintain consistency across the current Nuxt app.

Current status: the shipped v2 UI is the reference implementation. This document tracks the code; when the two disagree, the code wins and this file gets corrected.

## Design principles

These are the decided visual rules the v2 UI implements. They came out of the P1/RP1 design passes in `IMPLEMENTATION_PLAN.md` and are binding for new surfaces:

- **Road grammar** — plain roads whisper, scoring roads speak, missing roads disappear. Open roads are solid neutral gold spanning the full tile gap. Toll roads are two dashed rails in rust; bonus roads are two solid rails in honey-gold (pattern first, color second, so the signal survives color-blindness). Missing roads are true empty space, never a faint road.
- **Board-global modifiers** — toll and bonus values are stated once in the board legend (**Toll cost N**, **Road bonus N**), never as per-edge chips.
- **Mode identity is quiet** — Classic vs. Expedition reads from the mode switcher, background tint, and legend. No loud accent blocks behind the board.
- **Chrome recedes, the road speaks** — cards, gradients, and shadows exist to frame the game, not to compete with it. Prefer fewer, flatter surfaces; a new page section must justify its card.
- **Contextual messaging** — the board shows one contextual message or affordance per state, in the spirit of v1's footer (see `IMPLEMENTATION_PLAN.md` RP1-10). Information appears when the state demands it and disappears when play resumes.
- **Voice** — warm, direct, lightly road-themed. Locked terms: footprints, finish, attempt, Try again, Past Roads, Board total, Solved (never "Solved on target"), brand casing **GoldRoad**.

## Design Tokens

### Colors

#### Primary Palette
- `--color-gold` - Main gold color (goldenrod), with `--color-gold-dark`, `--color-gold-bright` (#d4af37), `--color-gold-muted`
- `--color-gold-rgb` - RGB triplet for use with opacity
- `--color-gold-muted` also carries Expedition's secondary emphasis (the stats page's Expedition streak line, `.streak-expedition` in `app/pages/stats.vue`). Silver was tried and rejected there: it read as an unrelated accent against a page that is otherwise gold/bronze, so a muted gold tone keeps it in the same family while still reading as secondary. No cyan accent tokens remain anywhere in the palette; Expedition's page-level identity comes only from `--mode-tint-expedition` (its hero-card background tint) and the mode switcher, never a colored board frame.

#### Backgrounds
- `--color-bg-deepest` / `--color-bg-dark` / `--color-bg-base` - Warm near-black browns for the app shell
- `--mode-tint-expedition` - Expedition hero-card tint

#### Semantic Colors
- Start/finish markers carry **no semantic color**: both render as gold-on-dark icon badges (`GameTile.vue` `.marker`), distinguished purely by icon — footprints for start, finish flag for the exit. No color tokens exist for start/finish.
- `--color-solved` (+ `-rgb`) - Solved-state green: the calendar's solved-day marker (`app/pages/games/index.vue` `.day-mark--solved`) and the stats page's positive feedback text
- `--color-success`, `--color-text-on-success` - Success badge fill and readable text color
- `--color-medal-silver-bright`, `--color-medal-silver-muted` - Silver medal tier colors
- `--color-text-on-silver`, `--gradient-medal-silver` - Text and gradient for silver medal surfaces
- `--color-medal-bronze-bright` - Bronze medal tier color
- `--color-text-on-bronze`, `--gradient-medal-bronze` - Text and gradient for bronze medal surfaces
- `--color-toll` (+ `-rgb`, `-bright`) - Toll roads, cautionary rust (#d2691e)
- `--color-bonus` (+ `-rgb`, `-bright`) - Bonus roads, honey-gold (#ffce3a)
- `--color-hint` (+ `-rgb`) - Hint highlighting (pink)
- `--color-focus` (+ `-rgb`) - The single focus color (#4b9eff blue) used by both component focus styles and the global `:focus-visible` outline

#### Text
- `--color-text-dark`, `--color-text-on-gold` - Dark text for gold-filled surfaces

#### Opacity

The current CSS mostly uses inline alpha values with RGB variables instead of a named opacity scale.

**Usage example:**
```css
background: rgb(var(--color-gold-rgb) / 0.18);
```

### Spacing

There is not currently a shared spacing scale. Components use local `rem` values. A future UI pass should decide whether to add spacing tokens or keep spacing component-local.

### Border Radius

- `--radius-sm` through `--radius-xl` - Various rounded corners
- `--radius-full` - Pill shapes (999px)
- `--radius-circle` - Perfect circles (50%)

### Typography

- Font sizes: `--font-size-xs` through `--font-size-3xl`
- Letter spacing: `--letter-spacing-wide`
- Line heights: `--line-height-snug`, `--line-height-base`

### Shadows

Predefined shadow styles:
- `--shadow-sm`, `--shadow-lg`, `--shadow-xl`, `--shadow-2xl` - Drop shadows
- `--shadow-glow-gold`, `--shadow-glow-gold-soft`, `--shadow-glow-hint`, `--shadow-glow-focus` - Glow effects for various elements
- `--shadow-inset-*` - Inset highlights
- `--shadow-border-*` - Border-like shadows

### Gradients

Reusable gradient patterns:
- `--gradient-bg-main` - Page background
- `--gradient-card-*` - Card and overlay backgrounds
- `--gradient-tile-done` - Completed tile gradient
- `--gradient-button-primary` - Primary button gradient

### Transitions

- `--transition-fast` - 140ms for quick interactions
- `--transition-base` - 200ms for standard transitions
- `--transition-slow` - 360ms for entrance animations

## Component Patterns

### Cards

```css
.card {
  border-radius: var(--radius-xl);
  padding: 1rem;
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  box-shadow: var(--shadow-lg);
}
```

### Buttons

```css
.button {
  border-radius: var(--radius-md);
  padding: 0.7rem 1rem;
  transition: transform var(--transition-fast);
}

.button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
```

### Eyebrow Text

Use the global `.eyebrow` class for section labels:

```html
<p class="eyebrow">Section Label</p>
```

## SVG Icons

The app uses inline SVG icons instead of CSS-based shapes for better scalability and clarity.

### Arrow Icons (BoardRoad component)

```vue
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="3"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M18 8L22 12L18 16" />
  <path d="M2 12H22" />
</svg>
```

Rotate the SVG for different directions:
- Right: `transform: rotate(0deg)`
- Left: `transform: rotate(180deg)`
- Down: `transform: rotate(90deg)`
- Up: `transform: rotate(-90deg)`

## Responsive Design

Board dimension tokens (`--tile-size`, `--tile-gap`, `--road-thickness`) shrink at **760px and below** in `main.css`; most components use the same 760px breakpoint for mobile layout. A few surfaces carry local breakpoints (980px on the current-road page for the wide layout, 768px on about/layout) — component-local by design.

## Accessibility

- Focus states use `--color-focus` everywhere — component focus styles and the global `:focus-visible` ridge outline
- Reduced motion support via `@media (prefers-reduced-motion: reduce)`
- Color is never the only signal: start/finish are distinguished by icon alone (footprints/flag — they share the same gold badge coloring), toll/bonus use distinct rail patterns (dashed/solid), medals pair color with counts and labels
- Proper contrast ratios maintained

## Usage in Components

### Import Global Styles

Global CSS is automatically loaded via `nuxt.config.ts`:

```typescript
css: ['~/app/assets/css/main.css']
```

### Using Variables in Scoped Styles

```vue
<style scoped>
.my-component {
  color: var(--color-gold);
  padding: 1rem;
  border-radius: var(--radius-xl);
  background: rgb(var(--color-gold-rgb) / 0.12);
}
</style>
```

## Maintenance

### Adding New Colors

1. Add the color to the `:root` section in `main.css`
2. If it needs opacity variants, add an RGB version
3. Document it in this file

### Adding New Components

1. Use existing design tokens wherever possible
2. Only add new tokens if the pattern will be reused
3. Keep scoped styles minimal - leverage global utilities

### Modifying the Theme

To change the overall color scheme:
1. Update the color variables in `:root`
2. All components will automatically reflect the changes
3. No need to touch individual component files

## Benefits Over CSS Frameworks

- **No learning curve** - Standard CSS custom properties
- **Smaller bundle** - Only the CSS you actually use
- **Full control** - Custom design without fighting framework defaults
- **Better performance** - No unused utility classes
- **Easier debugging** - Clear, readable CSS in DevTools
