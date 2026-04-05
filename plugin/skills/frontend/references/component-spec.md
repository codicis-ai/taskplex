# Component Specification Template

Use this template when planning non-trivial UI components. Ensures props, states, accessibility, and responsive behavior are defined before implementation.

## When to Use

- New component with more than basic rendering (has states, interactions, or variants)
- Component that will be reused across multiple views
- Component with complex accessibility requirements (modals, menus, forms)
- Skip for trivial wrappers or single-use layout divs

## Template

```markdown
## Component: {ComponentName}

### Purpose
{One sentence — what this component does and where it's used}

### Props
| Prop | Type | Default | Required | Description |
|------|------|---------|:---:|-------------|
| variant | 'default' \| 'compact' \| 'expanded' | 'default' | - | Visual variant |
| data | DataType | — | Y | The data to display |
| onAction | () => void | — | - | Callback when user acts |
| isLoading | boolean | false | - | Loading state |
| className | string | — | - | Additional CSS classes |

### States
| State | Trigger | Visual |
|-------|---------|--------|
| Default | Initial render with data | Normal display |
| Loading | isLoading=true or data fetching | Skeleton/shimmer |
| Empty | data is null/empty array | Empty state message + action |
| Error | fetch failed or invalid data | Error message + retry |
| Hover | Mouse over interactive elements | Highlight + cursor change |
| Focus | Keyboard navigation | Focus ring (visible) |
| Disabled | disabled=true | Reduced opacity, no interaction |

### Responsive Behavior
| Breakpoint | Layout | Notes |
|-----------|--------|-------|
| Mobile (<640px) | Stacked, full-width | Simplified view, touch targets 44px+ |
| Tablet (640-1024px) | {describe} | |
| Desktop (>1024px) | {describe} | Full feature set |

### Accessibility
- **Role**: {semantic HTML element or ARIA role}
- **Keyboard**: {Tab to focus, Enter/Space to activate, Escape to close, Arrow keys for navigation}
- **Screen reader**: {aria-label, aria-describedby, live regions for dynamic content}
- **Focus management**: {where focus goes on open/close/action}
- **Contrast**: {minimum ratio for text, interactive elements}

### Composition
{How this component relates to others}
- Parent: {what renders this component}
- Children: {what this component renders}
- Siblings: {related components that appear alongside}
- Reuses: {existing components from the library it builds on}

### Data Flow
- **Input**: {how data gets in — props, context, fetch}
- **Output**: {callbacks, events, state changes}
- **Side effects**: {API calls, localStorage, URL changes}
```

## Quick Spec (for simpler components)

For components that don't need the full template:

```markdown
## {ComponentName}
Props: { data: Type, variant?: 'a' | 'b', onAction?: () => void }
States: loading, empty, error, default
Responsive: stack on mobile, horizontal on desktop
A11y: role="button", keyboard: Enter/Space, aria-label required
```
