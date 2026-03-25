# Scope Calibration Guide

How to adjust depth based on what you're looking at.

## Detecting Scope

| User says | Scope | Example |
|-----------|-------|---------|
| A component name, file path, CSS class | **Component** | "audit PodCard", "review the sidebar" |
| A feature, pipeline, flow name | **Feature** | "audit the auto-bootstrap", "review the auth flow" |
| A view/page/tab name, URL path | **View** | "audit the History view", "review /governance" |
| A package, module, adapter, library | **Module** | "audit adapter-claude", "review the API layer" |
| An app name, "the whole thing", no qualifier | **Product** | "audit Agent World Viz", "product brief for the dashboard" |
| Multiple products, ecosystem, platform | **Multi-product** | "audit the claude-intelligence ecosystem" |

When ambiguous, ask: "Are you asking about {specific thing} or {broader thing}?"

## Detecting Product Type

| Signal | Product Type | Adapt how |
|--------|-------------|-----------|
| Routes, views, components, CSS, URLs | **UI App** | Evaluate visually, use agent-browser, check states and accessibility |
| Commands, flags, --help, terminal output | **CLI** | Run commands, check output formatting, test scriptability |
| Endpoints, HTTP methods, request/response | **API / Service** | Call endpoints, check error responses, verify docs accuracy |
| Exports, types, package.json main/types | **Library / Module** | Check API surface, import ergonomics, type quality |
| Pipeline configs, job definitions, queues | **Data / Infrastructure** | Check failure modes, observability, recovery paths |

Product type and scope are independent dimensions. A "product-level audit of a CLI" is different from a "feature-level audit of a web app." Calibrate both.

## Depth by Scope

### Component
- **Investigation**: Read component source, check props/inputs, list states
- **Inspection**: 1 screenshot/test, check interactive states if possible
- **Code analysis**: Component file + its direct imports
- **Report size**: 0.5-1 page
- **Time budget**: 5 minutes

### Feature
- **Investigation**: Trace the data/logic flow end-to-end, read all files involved
- **Inspection**: Walk the feature's user journey (3-5 checkpoints)
- **Code analysis**: All files in the feature's path
- **Report size**: 1-3 pages
- **Time budget**: 10-15 minutes

### View
- **Investigation**: Full view/surface analysis — content, interactions, states, data sources
- **Inspection**: Full walkthrough, state testing
- **Code analysis**: View component + subcomponents + stores + data fetching
- **Report size**: 2-4 pages
- **Time budget**: 15-20 minutes

### Module
- **Investigation**: API surface, consumer analysis, integration points, internal architecture
- **Inspection**: Only if module has user-facing exposure
- **Code analysis**: Package entry point, all exports, key internal files, consumer usage
- **Report size**: 3-5 pages
- **Time budget**: 20-30 minutes

### Product
- **Investigation**: All surfaces, cross-cutting concerns, navigation/command structure, data architecture
- **Inspection**: Every view/command/endpoint analyzed
- **Code analysis**: Entry point, router/command tree, all surfaces, shared stores/utils
- **Report size**: 5-15 pages
- **Time budget**: 30-60 minutes

### Multi-product
- **Investigation**: System boundaries, integration points, shared patterns, data flow between systems
- **Inspection**: Each product's primary surface
- **Code analysis**: Inter-package dependencies, shared types, communication protocols
- **Report size**: 8-20 pages
- **Time budget**: 45-90 minutes

## Scaling Rules

1. **Don't over-investigate small scopes.** A component audit doesn't need a user persona.
2. **Don't under-investigate large scopes.** A product audit that skips surfaces is useless.
3. **Match output to scope.** A brief for a feature is 1 page. A brief for a product is 5.
4. **Skip inapplicable sections.** Not every template section applies to every scope or product type. Omit rather than fill with fluff.
5. **Aggregate up.** When auditing a product, each surface gets a summary. The cross-cutting section does the synthesis.
