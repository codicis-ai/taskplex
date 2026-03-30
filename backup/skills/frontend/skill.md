---
name: frontend
description: Build production-grade frontend interfaces with design system awareness, accessibility, responsive patterns, and component architecture. Use this skill when building UI components, pages, or applications — whether a new feature, redesign, or component library work. Triggers on "build a component", "create a page", "design the UI", "add a form", "build a dashboard", "responsive layout", "fix the styling", "component library", "design system", "accessibility audit", "WCAG", "mobile layout", "CSS refactor", "frontend", "UI", "UX". Works standalone in any coding agent. Integrates with TaskPlex when running via /tp.
---

# Frontend Development Skill

Build production-grade frontend interfaces with structural rigor — design system awareness, component architecture, accessibility, responsive strategy, and visual quality.

## When This Skill Triggers

- Building UI components, pages, layouts, or applications
- Working with React, Vue, Svelte, Next.js, or HTML/CSS/JS
- Modifying `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss` files
- User mentions: UI, UX, component, page, layout, responsive, accessibility, design system, styling

## Standalone Usage (any coding agent)

This skill works independently — no TaskPlex required. When triggered:

1. **Detect project context** (before writing any code):
   - Read `./references/design-system.md` — detect existing design system, component library, design tokens
   - Read `./references/css-patterns.md` — detect CSS approach (Tailwind, CSS Modules, styled-components, etc.)
   - Scan the project for existing patterns: component structure, naming, file organization

2. **Understand the UI requirement**:
   - What is being built? (component, page, feature, layout)
   - Who uses it? (end users, developers consuming a library, internal tools)
   - What devices? (desktop-only, mobile-first, responsive)
   - Any accessibility requirements? (WCAG level, specific needs)

3. **Design before code**:
   - Read `./references/component-spec.md` — use the component spec template for non-trivial components
   - Read `./references/responsive.md` — determine breakpoint strategy
   - Read `./references/accessibility.md` — identify required aria patterns and keyboard interactions
   - Consider the visual direction — read the `frontend-design` plugin guidance if installed

4. **Implement**:
   - Follow the project's existing patterns (don't introduce new CSS approaches)
   - Build components with proper prop types, states, and variants
   - Include loading, error, and empty states
   - Implement responsive behavior
   - Add accessibility attributes (roles, aria-labels, keyboard handlers)
   - Write semantic HTML

5. **Visual verification**:
   - If agent-browser available: capture screenshots of key states (default, hover, mobile, error)
   - Read `./templates/visual-review.md` for the visual QA protocol
   - Present screenshots to the user inline

## TaskPlex Integration (when running via /tp)

When this skill is active inside a TaskPlex workflow, it enriches specific phases:

### Sub-phase A (Convention Check)
Load and apply:
- `./references/design-system.md` — detect design tokens, component library, theme
- `./references/css-patterns.md` — detect CSS approach, confirm with user

### Sub-phase B (Intent Exploration)
Add these to the context gathering:
- Target devices and breakpoints
- Accessibility requirements (WCAG level)
- Existing component reuse opportunities
- Visual direction (reference `frontend-design` plugin if installed)

### Planning (spec writing)
Include in agent context:
- `./references/component-spec.md` — template for component specifications
- Design system tokens and patterns discovered in Sub-phase A

### Implementation (agent prompts)
Include in Known Context block:
- CSS approach and conventions
- Component library patterns
- Accessibility patterns for this component type

### QA
Extend the e2e-reviewer protocol:
- `./templates/visual-review.md` — visual QA with responsive + accessibility checks
- Screenshot key views at desktop and mobile breakpoints
- Run basic accessibility checks (contrast, focus indicators, aria attributes)

---

## Reference Files

| File | Purpose | When to read |
|------|---------|-------------|
| `references/design-system.md` | Detect existing design systems, component libraries, design tokens | Before any UI work |
| `references/css-patterns.md` | Detect CSS approach, conventions, utility classes | Before any styling work |
| `references/component-spec.md` | Template for specifying component architecture | During planning/design |
| `references/responsive.md` | Breakpoint strategy, mobile patterns, container queries | When building responsive UI |
| `references/accessibility.md` | WCAG checklist, aria patterns, keyboard navigation | Every UI task |
| `templates/visual-review.md` | Visual QA protocol for screenshot-based review | During QA |

## Key Principles

1. **Detect before prescribe** — always check what the project already uses before suggesting patterns
2. **Accessibility is not optional** — every component needs keyboard nav, screen reader support, proper contrast
3. **Responsive is default** — assume responsive unless explicitly told otherwise
4. **States are not afterthoughts** — loading, error, empty, and edge states are part of the component, not extras
5. **Follow the project** — if the project uses Tailwind, use Tailwind. If it uses CSS Modules, use CSS Modules. Don't mix approaches.
6. **Visual quality matters** — use the `frontend-design` plugin's aesthetic guidance when available, but never at the expense of accessibility or usability
