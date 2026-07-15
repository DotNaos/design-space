# Design Space UX Expansion Checklist

This document is the durable source of truth for the laptop, canvas, editing, and mobile UX expansion requested on 2026-07-14.

- Primary issue: DotNaos/design-space#1
- Current delivery PR: DotNaos/design-space#3
- Owner: Selos-DL9WCD
- Scope: standalone, local-only Design Space runtime
- Explicit non-scope: deployment, production hosting, merge, or edits to `/Users/oli/projects/ui`

## Working agreement

- Keep every requested outcome in this file until it is verified or explicitly removed by the user.
- Update status and evidence as work proceeds; chat summaries are not the source of truth.
- Do not mark an item complete from implementation alone. Completion requires focused tests and relevant browser dogfooding.
- Preserve exact source diff, undo/reset, stale-source handling, Strict UI, and the server-owned trust boundary throughout the redesign.
- Treat the two untracked demo-target component documents already present in the worktree as user-owned local content. Do not edit or commit them.
- The A/B/C direction gate in `UX-003` is complete. Implementation follows the Canvas First structure with restrained Workbench actions.

Status legend: `[ ]` queued, `[-]` active, `[x]` verified, `[!]` blocked on a decision or external requirement.

## 0. Audit, coordination, and design gate

- [x] **UX-001 — Baseline UX audit.** Capture the current laptop and 390×844 flows, including panel layout, direct selection, slot selection, picker, diff, Tailwind editing, zoom extremes, and footer/status presentation. Record concrete problems rather than generic polish notes.
- [x] **UX-002 — Coordinate repository ownership.** Confirm no active Design Space or Component Lab task owns the same files. Keep the inactive DotNaos/ui worktree and shared `/Users/oli/projects/ui` checkout read-only.
- [x] **UX-003 — Produce and select A/B/C directions.** Create three compact mockup directions grounded in the current product. Each direction must show the laptop workspace and the mobile preview-plus-drawer pattern. Generated controls are directional, not literal requirements. Wait for the user's selection before broad UI implementation.
- [x] **UX-004 — Component Lab reference audit.** Inspect its canvas, gesture, grid, selection, and overlay behavior read-only. Record the exact reusable ideas and the parts intentionally replaced.
- [x] **UX-005 — Interaction state model.** Define Select, Hover, Insert, Interact, Context Menu, Panel Editing, Draft, Diff, Stale, and Blocked states so that canvas clicks and keyboard commands cannot trigger ambiguous behavior.

## 1. Laptop shell and navigation

- [x] **UX-010 — Resizable laptop panels.** Add pointer and keyboard-accessible splitters with sensible minimum/maximum widths, double-click reset, and persisted per-project sizes.
- [-] **UX-011 — Remove the permanent double-left-column layout.** Docs, Files, Catalog, and Component Tree must share one contextual left workspace instead of showing the tree beside the project browser. Switching views must preserve selection and search state.
- [x] **UX-012 — Stable contextual right panel.** Reserve the right side for Inspector, Slot details, Insert picker, Tailwind editor, and Diff. Switching tools must not cover or resize the canvas unexpectedly.
- [-] **UX-013 — Simplify the top bar.** Remove the Design Space logo/wordmark and retain only project/document context plus high-value actions.
- [-] **UX-014 — Replace the pink/purple visual language.** Establish a restrained neutral HeroUI theme with one functional accent, semantic status colors, and accessible contrast across canvas chrome, focus, selection, warnings, and Strict UI.
- [-] **UX-015 — Remove the AI-like footer presentation.** Replace phrases such as “Source Spec Document / No Unsafe Changes” with concise product language for saved, unsaved, checking, stale, blocked, and disconnected states. Avoid a persistent chatbot-style status strip.
- [-] **UX-016 — Shell regression coverage.** Test resizing constraints, persisted sizes, view switching, narrow fallback, keyboard operation, and restoration after reload.
- [x] **UX-017 — Mobile canvas HUD and drawers.** Remove the persistent mobile bottom navigation. Keep the canvas full-height, expose compact Project/Tree/Inspect HUD buttons over it, and open those workspaces as dismissible overlay drawers that preserve canvas context and safe areas.

## 2. Canvas selection, navigation, and rendering

- [x] **UX-020 — Figma-like direct canvas selection.** Clicking a rendered button, text node, nested component, slot, or internal HTML element selects the most specific editable target and updates Tree and Inspector together.
- [x] **UX-021 — Explicit Select versus Interact behavior.** Default canvas clicks select rather than activate target controls. Provide an obvious temporary or explicit Interact path without allowing target side effects by accident.
- [-] **UX-022 — Trackpad-first navigation.** Two-finger scroll pans, pinch zooms around the gesture centroid, and normal laptop use does not require click-and-drag grabbing. Keep touch pinch/pan and accessible zoom controls as fallbacks.
- [-] **UX-023 — High-quality zoom rendering.** Remove text pixelation, border shimmer, and fractional overlay drift at zoom extremes. Align camera, content, selection, and slot geometry to device pixels where appropriate without breaking anchored zoom.
- [x] **UX-024 — Dynamic dot grid.** Replace the current single-step grid with adaptive level-of-detail spacing. Keep dots visible but restrained when zoomed out, scale dot radius within readable bounds, and avoid moiré or a rigid static pattern.
- [x] **UX-025 — Anchor the grid to rendered HTML.** Treat the top-left of the rendered root HTML as the grid origin. Panning and anchored zoom must keep the grid and content in the same world coordinate system.
- [-] **UX-026 — Tree-to-canvas hover highlight.** Hovering a component, slot, or internal HTML row draws a non-interactive dashed preview outline without replacing the current selection. Clear it on leave, view switch, or source refresh.
- [-] **UX-027 — Collision-free overlays.** Prevent selected, hovered, Strict UI, and empty-slot outlines/labels from overlapping each other or escaping their measured target. Define deterministic z-order and label placement.
- [-] **UX-028 — Canvas rendering regression suite.** Cover pan, wheel, Safari/Chromium pinch, touch pinch, anchored zoom, grid LOD/origin, device-pixel geometry, nested hit testing, hover, selection, and overlay collision.
- [x] **UX-029 — Compact internal-HTML disclosure.** Remove the repeated full-width “Internal HTML” summary rows. Put an independent code/HTML disclosure control with the node count at the end of its owning component row, and expand only that component's internal tree without changing the component selection.
- [x] **UX-029A — Structural HTML rows.** Keep the compact disclosure borderless. When expanded, show balanced opening and closing tags and preserve the real hierarchy so slots nested inside revealed HTML receive the correct indentation.

## 3. Slots, keyboard actions, and context menus

- [-] **UX-030A — Figma hierarchy navigation.** On the focused canvas, Enter selects the first child, Shift+Enter selects the parent, and Tab/Shift+Tab move between siblings without opening editors or slot pickers. Canvas, Tree, and Inspector must keep one authoritative selection.
- [-] **UX-030B — Collapse and hidden implementation context.** Add Collapse all while preserving the selected path, automatically reveal/scroll canvas selections in the Tree, and highlight the union of hidden internal HTML when its disclosure is hovered or focused.
- [-] **UX-030C — Explicit Strict UI child allow-lists.** Every new slot must explicitly define accepted component IDs and a text policy. Picker and direct insertion fail closed. Provide a Layout example whose Sidebar and Main slots only accept their matching containers.
- [-] **UX-030D — Slot collections and component arguments.** Slot contracts distinguish a single child from an ordered child list with minimum/maximum cardinality. Component authoring exposes typed properties/arguments, defaults, required values, and option constraints.

- [-] **UX-030 — Delete selected composition content.** Delete/Backspace removes the selected child from its parent slot with undo, reset, exact diff, stale-source protection, and focus guards so text fields are never affected.
- [-] **UX-031 — Delete authored slot definitions safely.** In Library authoring only, allow an explicitly selected slot definition/outlet to be removed after dependency validation. Block destructive changes when dependent documents would become invalid.
- [-] **UX-032 — Slot Inspector.** Selecting a slot shows its label, occupancy, capacity, accepted component types, required/optional state, outlet/source context, Strict UI findings, and appropriate insert/clear/remove actions in the right panel.
- [-] **UX-033 — Context menu contract.** Add right-click and Shift+F10 menus for canvas and tree targets. Actions are target-specific: edit, insert, duplicate, delete/clear, open source, reveal in tree, reset property, and copy stable ID where applicable.
- [-] **UX-034 — Mobile context equivalent.** Provide a discoverable long-press or action-menu equivalent without relying on hover or right-click.
- [x] **UX-035 — Command safety and tests.** Route keyboard/context actions through typed document commands, never arbitrary paths or shell text. Test invalid targets, stale source, undo/redo, nested slots, required slots, and component dependency failures.

## 4. Picker, diff, and responsive editing surfaces

- [-] **UX-040 — Docked laptop insert picker.** Replace the blurred bottom-right modal with a right-side component list that keeps the selected slot and full canvas visible. Include search, groups, compatibility, empty/error states, and a clear close/back action.
- [-] **UX-041 — Mobile preview plus bottom drawer.** Keep a useful preview region visible above a physical-feeling drawer. Support compact and expanded snap points, safe areas, keyboard avoidance, search, and catalog selection without a full-screen blur.
- [-] **UX-042 — Rendered source diff viewer.** Replace plain text with a structured code-diff presentation: file tabs, line numbers, added/removed/changed emphasis, long-line handling, and accessible exact text. Source syntax highlighting remains a later enhancement.
- [-] **UX-043 — Preserve preview context during diff.** Laptop diff uses the right panel or a deliberate split view; mobile diff uses a drawer/full-height editor only when necessary. The user must be able to relate a changed line to the current preview.
- [x] **UX-044 — Honest diff and save states.** Preserve exact source bytes, preparation challenge, stale-source invalidation, compile failures, Strict UI blocks, save retry, undo, and reset.
- [-] **UX-045 — Responsive surface tests.** Verify desktop picker, mobile drawer snap points, visible selection context, no backdrop obstruction, diff readability, focus return, Escape/back behavior, and reduced motion.

## 5. Tailwind code editor and language intelligence

- [-] **UX-049A — Slider-first mapped controls and tooltips.** Use accessible HeroUI sliders for ordered Tailwind scales (spacing, radius, opacity, shadow), retain semantic selects and icon segments where appropriate, and add HeroUI tooltips to icon-only actions without replacing accessible labels.

- [x] **UX-050 — Official Tailwind intelligence spike.** Prove how the official Tailwind language service can run locally against the server-registered target configuration/theme without browser-supplied executable paths, commands, or module paths.
- [-] **UX-051 — Single-field Tailwind editor.** Add exactly one focused Tailwind class field, not a component source-code view. It may render committed classes as chips outside the typing surface, but editing remains one compact VS-Code-like input with keyboard navigation, completion UI, Tab acceptance, and mobile-safe text entry.
- [-] **UX-052 — Target-aware completion.** Complete utilities, variants, arbitrary values, target theme tokens, and registered custom classes from the actual opened project rather than a hardcoded Design Space list.
- [-] **UX-053 — Official diagnostics/lint.** Surface positional diagnostics actually provided by the official Tailwind language service, including proven CSS conflicts and other supported lint rules. Unknown or invalid utilities remain enforced by the compile/save gate.
- [x] **UX-054 — Preview and recovery integration.** Debounce language-service and Tailwind compilation work, keep the last valid preview during errors, prevent invalid Apply/Save, and recover without closing the editor.
- [x] **UX-055 — Language-service trust boundary.** Start only fixed server-owned language tooling for an already registered target. Bound request size and active work, supersede obsolete queued requests, reject stale results, and prove the service is absent from target production artifacts.
- [-] **UX-056 — Tailwind editor tests.** Cover completion, Tab acceptance, diagnostics, custom theme tokens, stale responses, compile failure/recovery, mobile keyboard layout, and arbitrary-input rejection.
- [x] **UX-057 — Canvas-linked visual Tailwind inspector.** A direct canvas selection must immediately open the matching right-side editor. Visual layout, spacing, size, typography, and appearance actions may be offered only when they map deterministically to Tailwind classes; the single Tailwind field remains the source representation.

## 6. Integration, accessibility, and delivery gates

- [-] **UX-060 — Cross-feature document tests.** Exercise selection → slot/picker → insert/edit → rendered diff → save → undo/reset across screen and component-library documents.
- [-] **UX-061 — Laptop dogfood.** Verify the real app at representative laptop widths with a trackpad-first path: resize panels, switch left views, hover/select nested items, context menu, delete, slot inspector, insert picker, Tailwind completion, diff, and save recovery.
- [-] **UX-062 — Mobile dogfood.** Verify 390×844 and a larger phone: preview/drawer, slot selection, catalog search, property/Tailwind editing, context actions, pinch/pan, diff, save, and keyboard/safe-area behavior.
- [-] **UX-063 — Accessibility pass.** Verify splitter semantics, keyboard selection, Shift+F10, focus restoration, screen-reader labels, contrast, touch targets, reduced motion, and no hover-only required action.
- [ ] **UX-064 — Performance pass.** Measure canvas gesture responsiveness, overlay re-measure frequency, tree hover latency, editor completion latency, and large-catalog behavior. Fix avoidable layout thrash and stale async work.
- [x] **UX-065 — Full repository gates.** Run typecheck, all tests, production build, local-only artifact proof, dependency audit, and exact-head CI.
- [x] **UX-066 — Delivery.** Keep the focused PR linked to issue #1, document exact Component Lab reuse, resolve review/CI findings requested by the user, and do not deploy or merge without explicit approval.

## Request coverage map

| User request | Checklist coverage |
| --- | --- |
| Laptop panels cannot resize | UX-010, UX-016 |
| Tree should not sit beside Docs/Files/Catalog | UX-011, UX-012 |
| Select buttons/elements directly in canvas | UX-020, UX-021, UX-028 |
| Trackpad-first scroll/zoom/pinch; no required grabbing | UX-022, UX-028, UX-061 |
| Pixelated text/borders and border shimmer | UX-023, UX-028 |
| Grid disappears; dots too small | UX-024, UX-028 |
| Grid aligned to rendered HTML top-left | UX-025 |
| Dynamic rather than static grid | UX-024 |
| Reuse/compare Component Lab canvas | UX-004, UX-066 |
| Tree hover highlights canvas | UX-026, UX-028 |
| Internal HTML summaries waste one row per component | UX-029 |
| HTML disclosure border, balanced tags, and nested slot indentation | UX-029, UX-029A |
| Delete key for slots/content | UX-030, UX-031, UX-035 |
| Selected slot missing from right panel | UX-032 |
| Right-click functionality | UX-033, UX-034, UX-035 |
| Plain-text source diff | UX-042, UX-043, UX-044 |
| Slot overlays overlap/glitch | UX-027, UX-028 |
| Laptop modal obscures selection | UX-040, UX-045 |
| Mobile preview plus bottom drawer | UX-041, UX-045, UX-062 |
| Replace mobile bottom navigation with HUD buttons and drawers | UX-017, UX-041, UX-045, UX-062 |
| Tailwind editor with completion and official lint | UX-050–UX-056 |
| Canvas selection opens a Figma-like Tailwind-only visual inspector | UX-020, UX-051, UX-057 |
| Pink/purple coloring | UX-014 |
| Remove Design Space logo | UX-013 |
| Remove AI-like footer wording | UX-015 |

## Baseline and reference evidence

Current-run visual evidence is stored outside the repository so screenshots cannot enter target production artifacts:

- `01-mobile-baseline.png` — 390×844 mobile workspace at Fit. The preview is small relative to the available canvas, the dock consumes a persistent row, the gesture hint competes with the task, and the footer reads like an assistant/evidence surface rather than an editor state.
- `02-laptop-baseline.png` — laptop workspace. Docs/Files/Catalog and Component Tree occupy two permanent left columns, neither side panel exposes a splitter, the brand consumes top-bar space, and selection/slot labels use the current purple/green visual language.
- `03-laptop-picker-baseline.png` — laptop slot-selection state. The selected Footer slot remains visible, but the modal picker model does not establish a stable side-by-side relationship between the canvas context and compatible components.

The implementation audit confirms the visible causes:

- `DocumentWorkspace.tsx` renders Workspace Browser and Component Tree as two fixed `lg:w-60` columns, a fixed desktop editor, a persistent status footer, and modal Diff/Picker surfaces.
- `PreviewCanvas.tsx` already supports direct DOM hit testing and anchored trackpad/touch zoom, but its root selection immediately opens editing, its dots use one fixed world step, it still advertises drag-to-pan, and all overlays share one viewport layer without collision placement.
- `SlotCatalogDialog.tsx` and `DiffSheet.tsx` both use blurred bottom modals on laptop. The diff remains a plain `<pre>` rather than a structured code view.
- `ComponentTree.tsx` exposes explicit slot occupancy and collapsed internal HTML, but has no hover-to-canvas channel or keyboard/context command layer.

Read-only Component Lab findings from `/Users/oli/projects/ui`:

- Reuse the concepts from `apps/component-lab/src/workspace/labWorkspace.tsx` and `state/useLabPanels.ts`: pointer splitters, clamped persisted widths, a single switchable utility panel, and a narrow-width floating fallback.
- Reuse the math and lifecycle ideas from `workspace/previewCanvas.tsx` and `previewCanvasGrid.ts`: cursor-anchored wheel zoom, two-finger wheel pan, adaptive world-grid steps, root-derived grid origin, `ResizeObserver`, and animation-frame batching.
- Reuse the selection/source concepts from `packages/react-ui/src/devtools/ComponentHierarchyInspector.tsx`, `ElementSelectionBridge.tsx`, and `SelectedComponentOverlay.tsx`: stable DOM metadata, most-specific inspectable targets, synchronized tree/canvas selection, source lookup, and portal overlays.
- Reuse the editor configuration seam from `apps/component-lab/src/source/sourceEditorConfig.ts`, but replace its read-only/minimal language setup with target-aware official Tailwind intelligence.
- Intentionally do not copy Component Lab's grab-first pointer layer, viewport-relative overlay labels, crowded DevTools presentation, or its fixed-radius dot SVG. Design Space needs trackpad-first navigation, collision-aware overlays, explicit composition commands, and world-consistent grid rendering.

## Chosen product direction

- The user delegated the final visual choice after reviewing the A/B/C sheet. Use **Canvas First** as the structural base and incorporate the useful **Workbench** actions where they improve editing.
- The canvas remains the dominant surface. The left side is one contextual, resizable workspace; the right side is one stable, contextual tool surface.
- Tailwind editing is not a full source-code panel. It is one compact class field with the official IntelliSense experience: completion, Tab acceptance, diagnostics, project-aware configuration, and automatic adoption of supported official language-service updates.
- The exact automatic-update mechanism must preserve the local-only trust model: Design Space may update its own pinned/approved tooling, but it must not execute a browser-supplied package, path, command, or arbitrary VS Code extension installation.

## Interaction state contract

- **Select is the default canvas state.** A click selects the most specific editable component, slot, or internal element and is stopped before the rendered app can execute it. A double-click opens its editor.
- **Hover is preview-only.** Tree hover may draw a dashed canvas outline but never changes selection or source.
- **Interact is explicit and temporary.** The canvas tool button switches to Interact so rendered controls receive clicks; changing documents returns to Select.
- **Insert is slot-scoped.** Only a registered slot with capacity may open the compatible catalog, and choosing an entry uses typed document commands.
- **Context Menu is selection-scoped.** Right-click, Shift+F10, or a stationary touch long-press selects one target and exposes only allowlisted actions for that target.
- **Panel Editing owns a local draft.** Tailwind and property input update an immediate preview but source changes still pass compile and Strict UI checks.
- **Diff is the save boundary.** A prepared exact diff is tied to one source snapshot and one-time challenge; it is invalidated by stale or concurrent source changes.
- **Stale and Blocked are non-destructive.** The last valid preview remains visible, Save stays unavailable, and the user can recover by reloading, correcting the draft, undoing, or resetting.

## Progress log

- **2026-07-14:** Captured the full request as stable work items. Coordination found no overlapping active Design Space or Component Lab task.
- **2026-07-14:** Completed the current laptop/mobile baseline audit and read-only Component Lab reference audit. The exact reuse and intentional replacement boundaries are recorded above. Broad UI implementation remains gated on the user's `UX-003` choice.
- **2026-07-14:** The user delegated the visual choice. Locked Canvas First plus restrained Workbench actions, and narrowed Tailwind to one IntelliSense-enabled class field rather than a source-code screen. The design gate is complete.
- **2026-07-14:** Browser-verified the laptop shell: one contextual left workspace, keyboard-resizable splitters, direct most-specific canvas selection, target-specific right-click actions, a docked slot picker, and independent compact internal-HTML disclosures.
- **2026-07-14:** Browser-verified the 390×844 slot flow. The compact picker occupies 52dvh with the preview still visible, expands to 82dvh, inserts a compatible component, opens the mobile item editor, and resets cleanly without saving.
- **2026-07-14:** Browser-verified the official Tailwind field on mobile: an incomplete utility exposes completions, Tab accepts the active choice, conflicting utilities show the official positional warning, and the compile-error state recovers without closing the editor. The server now bounds queued work, isolates stale diagnostics, shuts down terminally with Vite, and remains outside target production artifacts.
- **2026-07-14:** Browser-verified the structural tree on mobile and laptop: each component owns a borderless HTML-count disclosure, expanded markup has balanced opening/closing tags, and a slot hosted by a revealed `<div>` is indented inside that element.
- **2026-07-14:** Browser-verified the replacement mobile HUD at 430×932 and the laptop layout at 1440×900. Project/Tree/Inspect open as canvas-preserving drawers, selected preview content is refit above the drawer/editor, and the HUD is absent on laptop.
- **2026-07-14:** Browser-verified direct canvas editing on mobile and laptop. One click opens the matching item editor, visual controls emit exact Tailwind utilities, the single IntelliSense field reflects those classes immediately, and cancel discards the dogfood edit.
- **2026-07-14:** Resolved the independent final review findings: visual controls now remove conflicting axis/variant Tailwind utilities, touch pan/pinch can start over large empty-slot overlays, 1024px panel resizing always reserves a 320px canvas, and edit-target registration uses the bounded no-follow reader. Browser proof confirmed the minimum canvas width; `bun run verify` passes 87 files / 394 tests plus build and local-only isolation.
- **2026-07-14:** Completed the delivery gates on PR #3. The official Tailwind server follows real project readiness and runs in an isolated integration phase; `bun run verify` passes 88 files / 394 tests, `bun audit` reports no vulnerabilities, local-only isolation passes, and exact-head GitHub CI is green. No deploy or merge was performed.
