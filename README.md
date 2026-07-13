# Design Space

Design Space is a standalone, local-first UI IDE for React projects. A target project owns its adapter catalog, fixture, safe file display, and edit allowlist; starts Design Space from its own directory; and gets a direct React preview, component and file browsing, explicit child slots, Tailwind editing, exact source diffs, and guarded local saves.

It is deliberately not part of a target application's production build and has no deployment configuration.

## Try the included target

Requirements: Bun and Portless.

```bash
bun install
bun run dev
```

Open the stable Portless URL printed by the command, normally `http://design-space.localhost:1355`.

Raw Vite startup is blocked. `DESIGN_SPACE_ALLOW_DIRECT=1` is a noisy debugging escape hatch, not the normal workflow.

## Start from a target repository

Install Design Space as a development dependency and add a script such as `"design-space": "design-space"`. Running that script from the target repository discovers exactly one fixed server file: `design-space.server.ts`. The CLI accepts no root, path, command, or module arguments.

The server file exports a trusted `registration` with the project label, `design-space.config.tsx` target module, opaque file IDs, and opaque edit-target IDs. See `examples/demo-target/design-space.server.ts`. The React config owns the full adapter catalog, display-only file tree, and default component fixture; see `examples/demo-target/design-space.config.tsx`.

This split is intentional: the local developer chooses the target by the directory where the CLI starts, while the browser can only use the fixed opaque operations made available by that registration.

## What the first milestone includes

- Direct React adapter execution through a server-selected virtual module. There is no iframe boundary to design around.
- An expandable target-owned component catalog and a project/file browser.
- A component tree where all child-capable components declare named slots. Undeclared children are rejected.
- Used and empty slot states in both the tree and preview. Selecting either surface selects the same stable slot ID.
- Internal HTML collapsed inside components by default, with an explicit reveal control.
- Live Tailwind drafts compiled on demand against the full Tailwind theme, including valid classes that do not yet appear in source. Unknown utilities and external CSS resources are rejected before Diff or Save.
- Undo, reset, stale-source protection, one-time saves, atomic writes, and compile-error recovery.
- Desktop and narrow layouts. On narrow windows, the Inspector is available from the sliders icon instead of permanently compressing the canvas.

## Target-owned adapters

The included target in `examples/demo-target/design-space.config.tsx` is the reference contract. Every adapter supplies:

- a stable component ID, label, group, and optional safe source-file ID;
- an explicit `slots` array, including `[]` for components that cannot accept children;
- a render function receiving target-owned props and a named `slotChildren` map.

The target also supplies a default fixture. That fixture—not Design Space—defines the actual component instances, nested slot content, occupied states, preview composition, and page label. The visible tree is built through the same validated slot model used by the tests.

The fixed target-side `design-space.server.ts` selects the target module, files, edit markers, and optional target validation/compile hooks. It is a normal TypeScript module and may import target-owned server helpers. Set `compiler: "tsx"` on an edit target to require the complete edited source to pass a TSX compile before Design Space issues a save challenge. The process working directory supplies the canonical root. This registration is trusted server configuration. The browser cannot supply any of those paths or executable inputs.

The catalog UI enumerates every adapter exported by the selected target, so adding an adapter automatically expands the catalog without Design Space knowing the target library.

## Trust boundary

The browser has one same-origin JSON endpoint and four fixed operations:

- compile a Tailwind draft without accepting CSS resources or commands;
- read a registered edit target by opaque ID;
- prepare a validated edit against a source hash;
- save an unexpired one-time challenge.

It cannot send repository roots, file paths, commands, shell text, executable paths, module paths, or extra fields. On the server, canonical roots and allowlisted files are rechecked against traversal and symlink escapes before reads and writes. Saves recheck the source hash, preserve all text outside the marked string, and replace the file atomically.

Review approval remains outside Design Space. The signed Project CLI is the approval authority; browser state and local storage are never approval evidence.

## Local-only proof

`bun run verify:local-only` builds the representative target production entry separately, scans its output for Design Space runtime markers, and fails if hosting configuration appears in this repository. Design Space is a development tool only; do not add it to a target production entry.

## Verification

```bash
bun run verify
```

This runs strict type checking, the editor/model/server/application integration tests, the Design Space build, and the real target component's production-boundary proof. Tests cover target-project discovery, root confinement, arbitrary-input rejection, adapter and slot rules, full-theme Tailwind compilation, exact diffs, save/undo/reset, slow-preparation races, stale and concurrent changes, compile failures, expiring challenges, and atomic writes.

## Reused product contracts

The implementation was informed by read-only inspection of DotNaos UI and re-expressed as small standalone contracts:

- Component Lab's adapter/catalog shape;
- public component metadata and `data-ui` DOM markers;
- the selection bridge's stable selection payload;
- the Playground canvas's direct React rendering model;
- Review/Evidence source hashes and stale decisions;
- Strict UI status concepts and fixed same-origin approval bridge inputs.

The crowded floating DevTools shell, arbitrary-root review scanner, browser-supplied source paths, and UI-specific component assumptions were intentionally not reused. `/Users/oli/projects/ui` was never modified.
