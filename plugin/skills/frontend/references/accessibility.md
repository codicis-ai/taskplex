# Accessibility Reference

Every UI component must be accessible. This is not optional. Use this checklist for every component you build or modify.

## Minimum Requirements (all components)

### 1. Semantic HTML
- Use the correct HTML element (`button` not `div onClick`, `nav` not `div`, `h1-h6` in order)
- If no semantic element fits, use ARIA roles (`role="dialog"`, `role="tablist"`)
- Every `<img>` has `alt` text (empty `alt=""` for decorative images)
- Form inputs have associated `<label>` elements (via `htmlFor` or wrapping)

### 2. Keyboard Navigation
- All interactive elements reachable via Tab
- Logical tab order (follows visual reading order)
- Visible focus indicators (never `outline: none` without replacement)
- Standard key bindings:

| Element | Keys |
|---------|------|
| Button | Enter, Space → activate |
| Link | Enter → navigate |
| Checkbox | Space → toggle |
| Radio | Arrow keys → move selection |
| Select/Dropdown | Arrow keys → navigate, Enter → select, Escape → close |
| Modal/Dialog | Escape → close, Tab trapped inside |
| Menu | Arrow keys → navigate, Escape → close |
| Tab panel | Arrow keys → switch tabs |
| Slider | Arrow keys → adjust value |

### 3. Screen Reader Support
- `aria-label` or `aria-labelledby` for elements without visible text
- `aria-describedby` for supplementary descriptions
- `aria-live="polite"` for dynamic content updates (toast, status)
- `aria-expanded` for collapsible sections
- `aria-selected` for selected items in lists/tabs
- `aria-hidden="true"` for decorative elements

### 4. Visual
- Text contrast ratio: 4.5:1 minimum (normal text), 3:1 (large text 18px+)
- Interactive element contrast: 3:1 against background
- Don't rely on color alone (add icons, patterns, or text)
- Focus ring: visible, high contrast (2px+ solid, contrasting color)
- Touch targets: 44x44px minimum on mobile

## Component-Specific Patterns

### Modal / Dialog
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Title</h2>
  {/* content */}
  <button onClick={onClose}>Close</button>
</div>
```
- Trap focus inside modal (Tab cycles through modal elements only)
- Return focus to trigger element on close
- Close on Escape key

### Dropdown Menu
```tsx
<div role="menu" aria-labelledby="menu-button">
  <button role="menuitem" tabIndex={-1}>Option 1</button>
  <button role="menuitem" tabIndex={-1}>Option 2</button>
</div>
```
- Arrow keys navigate items
- Home/End jump to first/last
- Type-ahead: typing a letter focuses matching item

### Tabs
```tsx
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">Tab 2</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">Content</div>
```
- Arrow keys switch between tabs
- Tab key moves focus into the panel content

### Form Validation
```tsx
<input aria-invalid="true" aria-describedby="error-name" />
<span id="error-name" role="alert">Name is required</span>
```
- Announce errors via `role="alert"` or `aria-live="assertive"`
- Link error messages to inputs via `aria-describedby`
- Don't clear the form on error — preserve user input

### Loading States
```tsx
<div aria-busy="true" aria-live="polite">
  <span className="sr-only">Loading content...</span>
  {/* skeleton UI */}
</div>
```
- `aria-busy="true"` while loading
- Announce completion: "Content loaded" via live region
- Skeleton UI for visual users, sr-only text for screen readers

## Quick Audit (run after implementation)

```
1. Tab through the entire component — can you reach everything?
2. Activate every interactive element with keyboard only
3. Check: does every image have alt text?
4. Check: does every form input have a label?
5. Check: are focus indicators visible?
6. Check: can you close modals/menus with Escape?
7. Check: are dynamic updates announced (aria-live)?
```

If agent-browser is available:
```bash
agent-browser open {url}
agent-browser evaluate "document.querySelectorAll('img:not([alt])').length"  # should be 0
agent-browser evaluate "document.querySelectorAll('input:not([aria-label]):not([id])').length"  # check labels
agent-browser evaluate "getComputedStyle(document.querySelector(':focus')).outline"  # check focus visible
```
