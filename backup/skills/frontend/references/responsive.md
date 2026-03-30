# Responsive Design Reference

## Detect Project Breakpoints

Before implementing responsive behavior, check the project's existing breakpoint system:

```
# Tailwind breakpoints
Read: tailwind.config.{js,ts} — theme.screens section

# CSS custom breakpoints
Grep: "@media.*min-width|@media.*max-width" in **/*.{css,scss}

# Container queries
Grep: "@container|container-type" in **/*.{css,scss}
```

**If the project has defined breakpoints**: use them exactly. Don't invent new ones.

**If no breakpoints defined**, use these sensible defaults:

| Name | Width | Target |
|------|-------|--------|
| sm | 640px | Large phones (landscape) |
| md | 768px | Tablets |
| lg | 1024px | Small laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large screens |

## Mobile-First Approach

Write base styles for mobile, then add complexity at larger breakpoints:

```css
/* Base: mobile */
.card { flex-direction: column; padding: 1rem; }

/* Tablet and up */
@media (min-width: 768px) {
  .card { flex-direction: row; padding: 1.5rem; }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .card { gap: 2rem; }
}
```

Tailwind equivalent:
```html
<div class="flex flex-col p-4 md:flex-row md:p-6 lg:gap-8">
```

## Common Responsive Patterns

### 1. Stack to Horizontal
Mobile: vertical stack. Desktop: horizontal row.
```
Mobile:  [A]    Desktop:  [A] [B] [C]
         [B]
         [C]
```

### 2. Sidebar Collapse
Desktop: sidebar + content. Mobile: sidebar becomes off-canvas or bottom sheet.
```
Desktop:  [sidebar] [content]
Mobile:   [hamburger] [content] (sidebar as overlay)
```

### 3. Grid Reflow
Desktop: multi-column grid. Mobile: single column.
```
Desktop:  [1] [2] [3]    Mobile:  [1]
          [4] [5] [6]             [2]
                                  [3]...
```

### 4. Content Priority
Hide non-essential content on mobile. Show progressively on larger screens.
```
Desktop:  [avatar] [name] [email] [role] [joined] [actions]
Mobile:   [avatar] [name] [actions]
```

### 5. Touch Target Sizing
Minimum interactive target: **44x44px** on touch devices.
```css
@media (pointer: coarse) {
  .button { min-height: 44px; min-width: 44px; }
}
```

## Navigation Patterns

| Screen | Pattern |
|--------|---------|
| Desktop | Horizontal nav bar, sidebar nav, or mega menu |
| Tablet | Collapsed sidebar or horizontal with overflow scroll |
| Mobile | Hamburger menu, bottom nav bar, or slide-out drawer |

Detect existing pattern before implementing:
```
Grep: "hamburger|mobile-nav|drawer|bottom-nav|sidebar.*collapse" in **/*.{tsx,jsx,css}
```

## Typography Scaling

```css
/* Fluid typography */
html { font-size: clamp(14px, 1vw + 10px, 18px); }

/* Or step-based */
html { font-size: 14px; }
@media (min-width: 768px) { html { font-size: 16px; } }
@media (min-width: 1280px) { html { font-size: 18px; } }
```

## Testing Checklist

After implementation, verify at these widths:
- 320px (small phone)
- 375px (iPhone SE/standard)
- 768px (tablet)
- 1024px (small laptop)
- 1440px (desktop)
- 1920px+ (large screen — check max-width constraints)

If agent-browser available:
```bash
agent-browser open {url}
agent-browser evaluate "window.innerWidth = 375; window.dispatchEvent(new Event('resize'))"
agent-browser snapshot
agent-browser evaluate "window.innerWidth = 1440; window.dispatchEvent(new Event('resize'))"
agent-browser snapshot
```
