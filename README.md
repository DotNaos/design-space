# Design Space

Design Space is a standalone, local-first UI IDE for React projects. Its default workspace renders the project's real exported TSX components, reads props and slots from their TypeScript types, and derives the file tree from the selected frontend project. It does not require a generated component, slot, or file manifest.

It is deliberately not part of a target application's production build and has no deployment configuration.

## Try the included target

Requirements: Bun and Portless.

```bash
bun install
bun run dev
```

Open the stable Portless URL printed by the command, normally `http://design-space.localhost:1355`.

The included default target is a checked-in `clients/web` snapshot generated from
[`DotNaos/project-template`](https://github.com/DotNaos/project-template) at commit
`829a34a8ca91d69f81225fab380244614694ce1a`, plus the documented Design Space source paths. Its exact origin is recorded in `examples/source-target/project-template-origin.json`.

Raw Vite startup is blocked. `DESIGN_SPACE_ALLOW_DIRECT=1` is a noisy debugging escape hatch, not the normal workflow.

## Start from a target repository

Install Design Space as a development dependency and add a script such as `"design-space": "design-space"`. Run that script from the frontend project root, for example `clients/web`. That root owns a minimal `.designspace.ts`:

```ts
import { defineDesignSpace } from "@dotnaos/design-space/source-workspace";

export default defineDesignSpace({
  project: { id: "web", label: "Web app" },
  tablet: { fallback: "desktop" },
});
```

Source implementations live below category first and device second:

```text
src/app/
  root/{desktop,tablet,mobile}/
  pages/{desktop,tablet,mobile}/
  components/{desktop,tablet,mobile}/
```

Only real exported React components make a device path configured. Tablet may explicitly reuse Desktop or Mobile; no other device fallback is inferred. Component props and child slots come from the exported component's TypeScript props type. The preview never persists a parallel JSON description of that contract.

The TypeScript-first workspace currently provides indexing, rendering, navigation, file reading, and contract inspection. Source Diff and Save stay disabled until a conservative TypeScript edit path can preserve the real source without inventing a second model. Components with required props are likewise not executed until source-owned preview arguments exist.

The same contract can be placed at a React Native project root with `runtime: "react-native"`. Design Space currently indexes its source tree and TypeScript contracts separately; a simulator renderer is still required before native preview can be marked ready.

The component-library connection is derived from the frontend project's package dependencies. A normal package version is shown as a read-only release. `workspace:`, `file:`, or `link:` dependencies prove that a development source is connected; Design Space does not claim it is editable until that second project root has its own trusted write registration.

The CLI accepts no root, path, command, or module arguments. The local developer chooses the target by the directory where the CLI starts, while the browser receives only the server-indexed files and exports.

## Legacy document targets

The previous `design-space.server.ts` adapter/document target remains available for compatibility and for its guarded document-save workflow. See `examples/demo-target/design-space.server.ts` and `examples/demo-target/design-space.config.tsx`. New source workspaces should use `.designspace.ts` and real TSX instead of adding `.design.json` component descriptions.

## What the legacy document milestone includes

- Direct React adapter execution through a server-selected virtual module. There is no iframe boundary to design around.
- An expandable target-owned component catalog and a project/file browser.
- A component tree where all child-capable components declare named slots. Undeclared children are rejected.
- Used and empty slot states in both the tree and preview. Selecting either surface selects the same stable slot ID.
- Selecting an empty slot in the tree or preview opens a searchable component picker filtered to adapters accepted by that slot; insertion returns directly to the live preview.
- Internal HTML collapsed inside components by default, with an explicit reveal control.
- Live DOM observation supplies the complete internal HTML hierarchy and measured selection outlines, while preserving component and public-slot boundaries.
- App and Library modes can create trusted target-owned screens and components, rename screens, define component slots and typed properties, bind public properties to implementation controls, and edit the implementation body from the same phone UI.
- Live Tailwind drafts compiled through the target's trusted, fixed theme registration, including valid project utilities that do not yet appear in component source. Targets without a custom compiler use the bundled Tailwind fallback. Unknown utilities and external CSS resources are rejected before Diff or Save.
- Strict UI findings are tied to exact source evidence, shown in the tree and canvas, and block unsafe saves; component contract changes are also checked against every registered dependent document.
- Undo, reset, stale-source protection, one-time saves, atomic writes, and compile-error recovery.
- A dedicated phone layout with one full-width workspace at a time, labeled bottom navigation, touch-sized tree/catalog rows, pinch-to-zoom and drag-to-pan canvas controls, a mobile diff sheet, and full-screen Tree, Files, Catalog, and Inspector surfaces.

## Target-owned adapters

The included target in `examples/demo-target/design-space.config.tsx` is the reference contract. Every adapter supplies:

- a stable component ID, label, group, and optional safe source-file ID;
- an explicit `slots` array, including `[]` for components that cannot accept children;
- a render function receiving target-owned props and a named `slotChildren` map.

The target also supplies a default fixture. That fixture—not Design Space—defines the actual component instances, nested slot content, occupied states, preview composition, and page label. The visible tree is built through the same validated slot model used by the tests.

Targets that need application context can provide an optional `previewRoot` React component. Design Space wraps the complete direct preview once, so target-owned themes, HeroUI providers, routers, and other context remain available without introducing an iframe or a browser-selected module path.

The fixed target-side `design-space.server.ts` selects the target module, files, edit markers, document recipes, and target validation/compile hooks. Every document registration supplies `tailwindClassList`, which derives the complete utility graph from trusted adapter metadata and authored components; a project with no utilities returns an empty string explicitly. Set `compiler: "tsx"` on an edit target to require the complete edited source to pass a TSX compile before Design Space issues a save challenge. A target-owned Tailwind compiler receives only server-loaded contents and hashes for its fixed registered source IDs. The process working directory supplies the canonical root. This registration is trusted server configuration. The browser cannot supply any of those paths or executable inputs.

The catalog UI enumerates every adapter exported by the selected target, so adding an adapter automatically expands the catalog without Design Space knowing the target library.

## Trust boundary

The browser has one same-origin JSON endpoint and a closed set of schema-validated operations:

- list and read registered UI documents by opaque ID;
- read allowlisted project files by opaque ID;
- compile a Tailwind draft without accepting CSS resources or commands;
- prepare registered source edits or document creates/updates against current hashes;
- save an unexpired one-time challenge.

It cannot send repository roots, file paths, commands, shell text, executable paths, module paths, or extra fields. On the server, canonical roots and allowlisted files are rechecked against traversal and symlink escapes before reads and writes. Saves recheck the source hash, preserve all text outside the marked string, and replace the file atomically.

Review approval remains outside Design Space. The signed Project CLI is the approval authority; browser state and local storage are never approval evidence.

## Local-only proof

`bun run verify:local-only` builds the representative target production entry separately, verifies that it consumes the saved screen and authored-component documents, rejects Design Space application/server modules from the bundle graph, scans for runtime endpoint markers, and fails if hosting configuration appears in this repository. Design Space is a development tool only; do not add it to a target production entry.

## Verification

```bash
bun run verify
```

This runs strict type checking, the editor/model/server/application integration tests, the Design Space build, and the real target component's production-boundary proof. Tests cover target-project discovery, root confinement, arbitrary-input rejection, adapter and slot rules, target-theme Tailwind compilation, exact diffs, save/undo/reset, slow-preparation races, stale and concurrent changes, dependent component contracts, compile failures, expiring challenges, and atomic writes.

## Reused product contracts

The implementation was informed by read-only inspection of DotNaos UI and re-expressed as small standalone contracts:

- Component Lab's adapter/catalog shape;
- public component metadata and `data-ui` DOM markers;
- the selection bridge's stable selection payload;
- the Playground canvas's direct React rendering model;
- Review/Evidence source hashes and stale decisions;
- Strict UI status concepts and fixed same-origin approval bridge inputs.

The crowded floating DevTools shell, arbitrary-root review scanner, browser-supplied source paths, and UI-specific component assumptions were intentionally not reused. `/Users/oli/projects/ui` was never modified.
