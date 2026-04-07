# UX Heuristics Reference

Use these when evaluating in audit and review modes. Not all apply to every scope — pick what's relevant.

## Nielsen's 10 (adapted for developer tools)

### 1. Visibility of System Status
- Does the app show what's happening right now?
- Is there feedback for actions (loading, saving, errors)?
- Are async operations visible (spinners, progress, status)?
- **For dev tools**: Is the data fresh? Is there a connection indicator?

### 2. Match Between System and Real World
- Does terminology match what users expect?
- Are concepts organized in a familiar way?
- **For dev tools**: Does it use the same terms as the underlying system (e.g., "agent" vs "worker" vs "task")?

### 3. User Control and Freedom
- Can users undo actions?
- Can they navigate freely (back, escape, cancel)?
- Are there emergency exits from long operations?
- **For dev tools**: Can users refresh/retry/reset without losing context?

### 4. Consistency and Standards
- Do similar elements behave the same way?
- Are colors, icons, and patterns used consistently?
- Does it follow platform conventions?
- **For dev tools**: Are status colors consistent? (green=good, red=bad everywhere?)

### 5. Error Prevention
- Does the design prevent errors before they happen?
- Are destructive actions confirmed?
- Are invalid states prevented through the UI?
- **For dev tools**: Are file paths validated? Are configurations checked?

### 6. Recognition Rather Than Recall
- Is information visible when needed (not memorized)?
- Are options visible (not hidden in submenus)?
- Are relationships between elements visible?
- **For dev tools**: Can users see the full system state without digging?

### 7. Flexibility and Efficiency
- Are there shortcuts for experienced users?
- Can the interface be customized?
- Are common tasks streamlined?
- **For dev tools**: Keyboard shortcuts? Filters? Search?

### 8. Aesthetic and Minimalist Design
- Is irrelevant information hidden or deprioritized?
- Does every element earn its screen space?
- Is the visual noise level appropriate?
- **For dev tools**: Information density vs. clarity tradeoff.

### 9. Help Users Recognize, Diagnose, and Recover from Errors
- Are error messages in plain language?
- Do they explain what went wrong?
- Do they suggest a solution?
- **For dev tools**: Do error states show the actual error data?

### 10. Help and Documentation
- Is context-sensitive help available?
- Are complex features explained in-place?
- **For dev tools**: Are empty states educational?

## Empty State Heuristics

Empty states are the most common failure in developer tools. Evaluate:

1. **Does it explain why it's empty?** ("No agents connected" is better than a blank screen, but barely)
2. **Does it tell you what to do?** ("Start a task to see data" is actionable)
3. **Does it show what success looks like?** (A sample/preview of what the populated state would look like)
4. **Is it encouraging, not accusatory?** ("Getting started" vs "Error: no data")

## Developer Tool Specific

### Information Density
- Developer tools should lean toward high density (more data per pixel)
- But not at the cost of hierarchy — primary info must stand out
- Tables, monospace text, and compact layouts are expected
- Status at a glance is more valuable than pretty animations

### Real-time Data
- Is the data live or stale? Is this communicated?
- How frequently does it update? Is this visible?
- Can the user tell if the connection is broken?
- Is there a "last updated" timestamp?

### Progressive Disclosure
- Overview first, details on demand
- Summary cards that expand to detail views
- Collapsible sections for advanced data
- Don't overwhelm on first load

### Operational Context
- Can users take action from the tool? (not just observe)
- Are links to source material provided? (file paths, URLs)
- Can users copy relevant data? (IDs, paths, commands)
