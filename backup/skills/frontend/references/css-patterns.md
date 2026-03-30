# CSS Pattern Detection

Detect the project's CSS approach before writing any styles. Never mix approaches.

## Detection

### 1. Primary Approach

Check in order of priority:

```
# Tailwind CSS
Grep: "tailwindcss" in package.json
File: tailwind.config.{js,ts,mjs}
Grep: "className=\".*(?:flex|grid|p-|m-|text-|bg-|rounded)" in **/*.{tsx,jsx}

# CSS Modules
Glob: **/*.module.{css,scss}
Grep: "styles\." in **/*.{tsx,jsx}

# Styled Components / Emotion
Grep: "styled-components|@emotion/styled|@emotion/react" in package.json
Grep: "styled\.|css\`" in **/*.{tsx,jsx,ts}

# Vanilla CSS / SCSS
Glob: **/*.{css,scss} (not .module.css)
Grep: "import.*\.css|import.*\.scss" in **/*.{tsx,jsx}

# CSS-in-JS (other)
Grep: "stitches|vanilla-extract|linaria|panda" in package.json
```

### 2. Conventions to Follow

Once detected, apply these rules:

**Tailwind:**
- Use utility classes, not custom CSS (unless extending the config)
- Follow the project's custom class patterns (`@apply` usage, component variants)
- Use `cn()` or `clsx()` for conditional classes if the project does
- Respect the tailwind.config theme — don't hardcode values that exist as tokens

**CSS Modules:**
- One `.module.css` per component
- Use camelCase class names (maps to JS property access)
- Compose shared styles via `composes:` not duplicate rules
- Keep module files next to their component

**Styled Components / Emotion:**
- Follow the project's pattern (styled.div vs css prop vs styled())
- Use theme values from ThemeProvider, not hardcoded values
- Keep styled definitions in the same file or a `*.styles.ts` file

**Vanilla CSS / SCSS:**
- Follow existing naming convention (BEM, SMACSS, or custom)
- Use the project's variable/mixin system
- Follow the existing file structure (single global file vs per-component)

### 3. Common Patterns to Detect

```
# Utility functions for class names
Grep: "cn(|clsx(|classnames(|twMerge(" in **/*.{ts,tsx,js,jsx}

# CSS variable usage
Grep: "var(--" in **/*.{css,scss}

# PostCSS plugins
Read: postcss.config.{js,ts,mjs}

# Preprocessor
Grep: "sass|less|stylus" in package.json
```

## Output

```
CSS Approach:
  Primary: Tailwind CSS v3.4
  Class utility: cn() (lib/utils.ts)
  Custom theme: Yes (tailwind.config.ts with extended colors + spacing)
  PostCSS: autoprefixer, tailwindcss
  Global styles: src/app/globals.css (base layer customizations)

Rules for this task:
  - Use Tailwind utility classes exclusively
  - Use cn() for conditional class composition
  - Reference theme tokens from tailwind.config, not hardcoded values
  - No inline styles, no separate CSS files
```
