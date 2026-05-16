---
version: alpha
name: Agent Platform Runtime Console
description: A developer-first Agent Runtime workspace inspired by Supabase's white-canvas, emerald-accent, code-forward design language and adapted to Google DESIGN.md's token-plus-rationale format. The interface is an operational control surface, not a marketing landing page.
colors:
  primary: "#3ecf8e"
  primary-deep: "#24b47e"
  primary-soft: "#dff8ed"
  ink: "#171717"
  ink-secondary: "#2a2f2c"
  ink-muted: "#707070"
  ink-faint: "#9a9a9a"
  canvas: "#ffffff"
  canvas-soft: "#fafafa"
  canvas-wash: "#f4f6f5"
  canvas-night: "#1c1c1c"
  surface: "#ffffff"
  surface-subtle: "#f6f8f7"
  hairline: "#dfdfdf"
  hairline-strong: "#c7c7c7"
  success: "#24b47e"
  warning: "#b7791f"
  danger: "#b42318"
  on-primary: "#171717"
  on-dark: "#ffffff"
typography:
  display:
    fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: 0
  heading:
    fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  body:
    fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label:
    fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  code:
    fontFamily: "ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 16px
  product-pane:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  code-block:
    backgroundColor: "{colors.canvas-night}"
    textColor: "{colors.on-dark}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
    padding: 16px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  status-pill:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
---

## Overview

Agent Platform is a browser-based Agent Runtime workspace. Its UI should feel like a professional developer tool: clear, direct, operational, and grounded in visible product state. The design direction is adapted from a Supabase-like system: white canvas, near-black typography, sparse emerald interaction color, compact controls, code-forward surfaces, and product UI panels as the main visual argument.

This project should not look like a generic AI landing page. The first screen should be radically simple: one intent input that starts an Agent Run. Runtime stream, checkpoints, metrics, and artifacts appear only after a run begins. Avoid feature lists as the main page structure.

## Colors

Use `canvas` and `canvas-soft` as the dominant surfaces. Use `ink` for primary text and `ink-muted` for helper copy. The primary emerald is reserved for the most important action, active state, or healthy runtime signal. Do not turn emerald into a decorative background motif.

Semantic accents are functional only:

- `success` for finished or healthy runtime states.
- `warning` for HITL checkpoints and paused execution.
- `danger` for failed runs, rejected decisions, and destructive actions.

Do not introduce purple-blue gradients, bokeh backgrounds, neon accents, or large decorative color fields. Charts or future observability views may use additional colors, but those colors belong inside data visualization, not the global UI identity.

## Typography

Use Inter as the open-source default for display and UI text. Keep display type compact and controlled. Do not scale text directly with viewport width and do not use negative letter-spacing in application panels.

Use system monospace for runtime identifiers, event types, traces, code snippets, and low-level metadata. The UI may show technical detail, but technical detail should be arranged as scan-friendly rows, chips, or panes rather than large paragraphs.

## Layout

The primary route has two progressive states:

1. Launch state: one centered intent input and one submit affordance. No capability catalog, no runtime panels, no operational side rail.
2. Runtime state: a compact working console with the start/composer panel, central runtime stream, result dock, and operational side rail.

Prefer dense but calm information architecture. Group related operational surfaces into panels. Keep the product visible above the fold. Do not add a marketing hero before the workspace.

Use an 8px spacing rhythm:

- 8px for tight internal gaps.
- 16px for panel padding and ordinary section gaps.
- 24px for page-level separation.
- 32px or 64px only for larger documentation or marketing surfaces.

## Elevation & Depth

Depth should come from product panes, not decorative backgrounds. Default panels use 1px hairline borders and minimal shadow. Floating or modal surfaces may use a stronger shadow, but the base workspace should remain flat enough for long sessions.

Elevation scale:

- Level 0: flat surface with 1px hairline, used for panels and forms.
- Level 1: subtle shadow for active product panes.
- Level 2: stronger shadow for modals or floating overlays.

Do not use glassmorphism, gradient orbs, heavy blur, or stacked decorative cards.

## Shapes

Use square-ish radii:

- 6px for buttons and form controls.
- 8px for compact panels and alerts.
- 12px for larger product panes and artifact cards.
- Full pill only for status chips, tiny tags, and avatars.

Cards should not be nested inside other decorative cards. Use panels for tools, repeated artifact cards for output, and modal overlays only when the workflow truly needs focus.

## Components

Primary components:

- `AppHeader`: product name, environment, and high-level context.
- `LaunchComposer`: the initial single-input entry surface.
- `PromptConsole`: scenario selector, intent textarea, and primary run action.
- `RunStream`: live event conversation and runtime status.
- `ResultDock`: generated artifacts and rendered outputs.
- `OpsRail`: snapshot counts, event chips, observability summaries, and HITL checkpoints.
- `CheckpointPanel`: approval/rejection flow with a concise schema summary.
- `ArtifactCard`: renderer metadata and artifact body.

Component rules:

- Primary CTA uses emerald with near-black text.
- Secondary or destructive actions are outline/subtle, never competing filled colors.
- Inputs are white, bordered, and compact.
- Status chips are readable and functional, not decorative.
- Code and runtime metadata should use monospace inside constrained panes.

## Do's and Don'ts

Do:

- Make the workspace usable as the first viewport.
- Make the initial launch state feel like an input box, not a dashboard.
- Keep emerald scarce and meaningful.
- Normalize runtime IDs and technical data into compact labels.
- Show run state, event count, HITL state, and artifacts where they help the user decide the next action.
- Use product UI panes as the visual centerpiece.
- Keep copy direct, operator-focused, and short.

Don't:

- Do not build a landing page unless explicitly requested.
- Do not list every platform capability on the entry page.
- Do not use oversized hero text inside application panels.
- Do not use purple/blue gradients or ornamental background shapes.
- Do not add new UI libraries or icon systems without a concrete need.
- Do not hide HITL or runtime status behind marketing copy.

## Responsive Behavior

Desktop launch state should center the single input. Runtime state should use a multi-column console layout. Tablet may collapse the operational rail below the main stream. Mobile runtime state should become a single-column workflow in this order: prompt console, run stream, result dock, operational rail.

Touch targets must be at least 36px high. Buttons may become full width on narrow screens. Long runtime IDs, event names, and artifact renderer names must wrap or truncate gracefully without breaking panel layout.

## Product Goals

Goals:

- Help users start an Agent Run without reading a capability catalog.
- Let first-time users see exactly one primary action before a run exists.
- Make runtime progress and state inspectable.
- Keep human checkpoints visible and actionable.
- Present artifacts as durable outputs rather than chat leftovers.
- Support future observability surfaces without redesigning the workspace.

Non-goals:

- Generic AI chatbot UI.
- Workflow-builder marketing page.
- Feature matrix.
- Decorative showcase page.

## Personas and Jobs

Primary users are operators, reviewers, and builders validating agent runtime behavior.

Jobs:

- Choose a scenario.
- Describe intent and constraints.
- Observe runtime events.
- Approve or reject human checkpoints.
- Inspect final artifacts.
- Debug or validate a run from its visible state.

## Content Voice

Tone should be direct, calm, and precise. Use product terms consistently: Agent Run, Runtime, checkpoint, event stream, artifact, HITL, observability.

Microcopy should explain what happens next, not restate backend architecture.

## Implementation Constraints

Framework: Next.js App Router with React and plain CSS in `apps/web/app/globals.css`.

Reuse existing packages:

- `@agent-platform/protocol` for runtime event naming.
- `@agent-platform/renderer` for artifact rendering.
- Existing API routes for runs, HITL, events, and artifacts.

Avoid adding frontend dependencies for visual polish. Prefer local CSS tokens and existing component boundaries until the design system stabilizes.

## Open Questions

- Should the product name remain "Agent Platform" or become a more distinctive runtime-console brand?
- Which scenarios should be first-class presets in the prompt console?
- Should observability metrics and traces appear in the web workspace or remain API-only for now?
