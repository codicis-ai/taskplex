# Visual Review Protocol

Use this protocol after implementing UI changes to visually verify the result with the user. Requires agent-browser.

## When to Run

- After implementing any visible UI change
- After modifying CSS/styling
- After adding new pages or components
- During QA phase for UI App product types

## Protocol

### 1. Capture Key States

For each affected page/component, capture at minimum:

| State | What to capture |
|-------|----------------|
| Default | Normal rendering with data |
| Empty | No data / first-time user state |
| Loading | Skeleton/spinner state (if applicable) |
| Error | Error state rendering |
| Mobile | 375px width |
| Desktop | 1440px width |

```bash
# Desktop view
agent-browser open {url}
agent-browser snapshot

# Mobile view
agent-browser evaluate "document.documentElement.style.width='375px'"
agent-browser snapshot

# Or use viewport parameter if available
agent-browser open {url} --viewport 375x812
agent-browser snapshot
```

### 2. Check Interactions

```bash
# Hover states
agent-browser hover @{element}
agent-browser snapshot

# Focus states (keyboard)
agent-browser evaluate "document.querySelector('{selector}').focus()"
agent-browser snapshot

# Active/click states
agent-browser click @{element}
agent-browser snapshot
```

### 3. Check Console

```bash
agent-browser console
# Should show no errors related to the modified components
# Warnings about missing keys, prop types, etc. should be noted
```

### 4. Present to User

**Show screenshots inline in the conversation.** Do NOT say "check the screenshot at..." — present the visual directly.

Format:

> **Visual Review: {component/page name}**
>
> **Desktop (1440px):**
> {screenshot}
>
> **Mobile (375px):**
> {screenshot}
>
> **Key interactions tested:**
> - Hover on primary button: {highlight effect visible}
> - Tab navigation: {focus ring visible on all interactive elements}
> - Empty state: {shows placeholder message with action}
>
> **Console:** Clean (no errors)
>
> Does this match your expectations? Any visual adjustments needed?

### 5. Quick Accessibility Visual Check

While you have the page open:

```bash
# Check focus visibility
agent-browser evaluate "
  const focusable = document.querySelectorAll('button, a, input, select, textarea, [tabindex]');
  focusable.forEach(el => { el.focus(); });
  // Check if focus ring is visible
"

# Check for missing alt text
agent-browser evaluate "document.querySelectorAll('img:not([alt])').length"

# Check contrast (basic)
agent-browser evaluate "
  const body = getComputedStyle(document.body);
  console.log('Background:', body.backgroundColor, 'Color:', body.color);
"
```

## Without agent-browser

If agent-browser is not available, describe the expected visual result to the user:

> **Expected visual (no browser available for screenshots):**
>
> Desktop: Two-column layout with sidebar (240px) and main content. Card grid in 3 columns.
> Mobile: Single column, sidebar collapses to hamburger menu. Cards stack vertically.
> Colors: Uses --primary (#3b82f6) for buttons, --background (#ffffff) for cards.
> Typography: Inter 14px body, 24px headings.
>
> To verify visually: run `npm run dev` and check {url}.
