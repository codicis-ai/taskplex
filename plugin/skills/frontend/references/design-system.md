# Design System Detection

Before writing any UI code, detect the project's existing design system. Don't introduce new patterns — follow what's already established.

## Detection Checklist

### 1. Component Library

Scan for existing component libraries:

```
# Check package.json for UI libraries
Grep: "shadcn|radix|chakra|mantine|material-ui|mui|antd|headless-ui|daisyui|flowbite" in package.json

# Check for local component library
Glob: src/components/ui/**/*.{tsx,jsx,vue,svelte}
Glob: src/lib/components/**/*.{tsx,jsx,vue,svelte}
Glob: components/ui/**/*.{tsx,jsx,vue,svelte}
```

If found: **USE IT**. Don't build custom components that duplicate library components. Check what's available before creating new ones.

### 2. Design Tokens

Look for token definitions:

```
# CSS custom properties
Grep: "--color-|--spacing-|--font-|--radius-|--shadow-" in **/*.css

# Tailwind config
Read: tailwind.config.{js,ts,mjs} — theme.extend section

# Token files
Glob: **/tokens.{css,json,ts,js}
Glob: **/theme.{ts,js,css}
Glob: **/variables.{css,scss}
```

Record tokens found:
- **Colors**: primary, secondary, accent, semantic (success, warning, error, info)
- **Spacing**: scale system (4px, 8px, etc. or sm, md, lg)
- **Typography**: font families, size scale, weight scale, line heights
- **Borders**: radius scale, border widths
- **Shadows**: elevation scale
- **Breakpoints**: responsive breakpoint values

### 3. Theme System

```
# Dark mode support
Grep: "dark:|dark-mode|theme-dark|color-scheme|prefers-color-scheme" in **/*.{css,tsx,jsx}

# Theme provider
Grep: "ThemeProvider|ThemeContext|useTheme|createTheme" in **/*.{tsx,jsx,ts,js}
```

If dark mode exists: new components must support both themes using the existing token system.

### 4. Icon System

```
# Icon library
Grep: "lucide|heroicons|phosphor|react-icons|@iconify" in package.json

# Custom icons
Glob: **/icons/**/*.{tsx,jsx,svg}
```

Use the project's icon library. Don't mix icon systems.

### 5. Layout System

```
# Layout primitives
Grep: "Container|Stack|Flex|Grid|Box|Layout" in src/components/**/*.{tsx,jsx}

# Layout patterns
Grep: "sidebar|header|footer|nav|main-content|app-shell" in **/*.{tsx,jsx,css}
```

## Output

After detection, summarize what you found:

```
Design System:
  Component library: shadcn/ui (radix primitives)
  CSS approach: Tailwind CSS with custom theme
  Tokens: CSS variables in globals.css (--primary, --secondary, etc.)
  Dark mode: Yes (class-based, via next-themes)
  Icons: Lucide React
  Layout: App shell with sidebar (components/layout/)
  Spacing: Tailwind default scale (4px base)
  Typography: Inter (body), JetBrains Mono (code)

Rules for this task:
  - Use shadcn/ui components where available
  - Follow Tailwind conventions (no raw CSS unless necessary)
  - Support dark mode via existing theme tokens
  - Use Lucide icons
  - Place new components in src/components/
```
