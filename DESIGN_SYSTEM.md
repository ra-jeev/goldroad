# Gold Road Design System

This document describes the centralized design system implemented in `app/assets/css/main.css`.

## Overview

The design system uses CSS custom properties in `app/assets/css/main.css` to maintain consistency across the current Nuxt app.

Current status: this file is a working reference, not a finished design spec. The board grid is the strongest current UI surface. The page shell, board header, board footer, Classic/Expedition switcher, and stats page are scheduled for another design pass in `IMPLEMENTATION_PLAN.md`.

## Design Tokens

### Colors

#### Primary Palette
- `--color-gold` - Main gold color (goldenrod)
- `--color-gold-dark` - Darker gold variant
- `--color-gold-bright` - Brighter gold (#d4af37)
- `--color-gold-rgb` - RGB values for use with opacity (218, 165, 32)

#### Semantic Colors
- `--color-start` - Start tile indicator (green)
- `--color-end` - End tile indicator (red)
- `--color-active` - Active/available tiles
- `--color-blocked` - Missing-road / unavailable-road color (legacy token name)
- `--color-toll` - Toll roads
- `--color-bonus` - Bonus roads (green)
- `--color-hint` - Hint highlighting
- `--color-focus` - Focus states

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
- Letter spacing: `--letter-spacing-tight`, `--letter-spacing-wide`
- Line heights: `--line-height-snug`, `--line-height-base`

### Shadows

Predefined shadow styles:
- `--shadow-sm` through `--shadow-2xl` - Drop shadows
- `--shadow-glow-*` - Glow effects for various elements
- `--shadow-inset-*` - Inset highlights
- `--shadow-border-*` - Border-like shadows

### Gradients

Reusable gradient patterns:
- `--gradient-bg-main`, `--gradient-bg-classic`, `--gradient-bg-expedition` - Page backgrounds
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

The design system includes responsive breakpoints:

- **980px and below** - Tablet layout adjustments
- **760px and below** - Mobile optimizations (smaller tiles, stacked layouts)

## Accessibility

- Focus states use `--color-focus` with visible outlines
- Reduced motion support via `@media (prefers-reduced-motion: reduce)`
- Semantic color usage (green for start, red for end)
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
