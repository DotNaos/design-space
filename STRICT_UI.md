# Strict UI Constitution

This document is the canonical product and architecture contract for Strict UI in Design Space.
When the implementation, examples, older adapter formats, or other documentation disagree with this
document, this document defines the intended direction. Transitional behavior must be described as a
conformance gap; it must not silently redefine Strict UI.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## Purpose

Strict UI makes a React interface structurally understandable, safely editable, and mechanically
validatable without inventing a second description of the application.

Design Space is a renderer and IDE over the project's real TypeScript and JSX. TypeScript source is the
contract; JSX source is the composition; the running preview is evidence. Generated component schemas,
parallel design documents, and manually duplicated slot manifests are not sources of truth.

## The complete node model

A Strict UI source tree has exactly three node kinds:

1. **Component** — a TypeScript-resolved React component use.
2. **HTML** — an intrinsic JSX element resolved through `JSX.IntrinsicElements`.
3. **Slot** — an explicitly named, typed, and validated insertion point declared by a component.

There are no Page, Layout, Fragment, Text, Content, or Root node kinds.

- A page is a component used by routing.
- A layout is a component used as application composition.
- The root is the configured entry component.
- Fragments are transparent and their children are flattened into their owner.
- Static text and non-slot expressions are editable source values owned by their containing node.

## Component contract

A component is an exported TypeScript symbol that the TypeScript compiler resolves as a valid React JSX
element. PascalCase is a syntax convention, not sufficient evidence on its own.

Design Space MUST resolve normal functions, arrow functions, named and default exports, and wrappers such
as `memo` and `forwardRef` back to the owning component definition. A component's stable source identity is:

```text
project + source file + export name
```

Each JSX use of that definition is a component instance in the composed app tree. The definition remains
owned by its source file regardless of how many instances exist.

Component props MUST be read from the compiler-resolved TypeScript props type. Ordinary values such as
`string`, `number`, `boolean`, enums, and structured data are properties, not source-tree nodes.

## Colocated component designs

Design Space MUST NOT execute an indexed source component directly. Every previewable component, page,
or layout has a colocated `.design.tsx` module that imports the real component and binds it with
`defineComponentDesign`. The implementation source remains the authority shown in the Source tree and
Code tab; only the design module is executable preview input.

The component props interface is the only property and slot schema. A design MUST NOT redeclare property
names, property types, requiredness, finite choices, or slot contracts. It supplies concrete preview
values, providers, callbacks, and typed slot content. Design Space derives finite property-matrix axes
from compiler evidence such as literal unions, enums, and booleans. Arbitrary strings, numbers, objects,
callbacks, and external data require explicit preview values because Design Space MUST NOT invent them.

Statefulness is semantic and therefore explicit through the simple `isStateful` boolean. It MUST NOT be
inferred from React hooks or prop names. A stateless design exposes one or more named designs and MUST
include `default`. A stateful design exposes named states and MUST name one existing `initialState`.
Both forms are normal TypeScript: their values MUST satisfy the real component props type, and the
compiler MUST reject an `initialState` that is not a key of the declared `states` object.

```tsx
import { Button } from "./Button";
import { Panel } from "./Panel";

export default defineComponentDesign(Panel, {
  isStateful: false,
  defaults: { tone: "neutral", slots: { content: <Button slots={{ label: "Continue" }} /> } },
  preview: {
    background: "#141518",
    minHeight: 320,
    padding: 24,
    width: 480,
    layout: "center",
  },
  designs: {
    default: {},
    success: { tone: "success" },
    withSecondaryAction: {
      slots: { content: <Button variant="secondary" slots={{ label: "Continue" }} /> },
    },
  },
  render: (props) => <Panel {...props} />,
});
```

The optional `preview` object describes only the isolated canvas environment: its background, dimensions,
padding, and placement. It MUST NOT change the component's own props or authored styles. Named `designs`
or `states` are the typed props presets shown in the Properties dropdown. They MAY contain JSX values,
including compatible components for typed slots, because the real props type remains the compiler-owned
contract.

Preview readiness follows an explicit state machine: missing design, checking, invalid design, ready,
runtime crash, or last-valid preview while an edit is invalid. Only ready or last-valid evidence may
reach the canvas renderer. Slot and HTML isolation MUST render through the active design as well; there
is no direct-render fallback.

## HTML contract

An HTML node is an intrinsic JSX element such as `<main>`, `<section>`, or `<button>`. Its identity and
source binding come from its exact location in the owning component's JSX.

Internal HTML MUST remain owned by the component that authored it. It MAY be revealed and selected in the
composed tree, but revealing it does not break the component boundary or transfer source ownership to the
caller.

Text, conditions, loops, and expressions do not create additional node kinds. Design Space MAY expose
their editable values in the code or property editor while keeping the three-kind tree intact.

## Slot contract

A slot is never inferred from `children`, `ReactNode`, a prop name, rendered DOM, or a separate JSON file.
A slot exists only when the component's TypeScript contract declares it explicitly as a Strict UI slot.

`children` is forbidden on Strict UI components. Every Strict UI component props type MUST reject it:

```tsx
interface StrictComponentProps {
  children?: never;
}
```

Slots MUST be named, typed, and cardinality-aware. The following names illustrate the normative contract:

```tsx
export interface PanelSlots {
  header: ComponentSlot<typeof Heading>;
  content: ComponentSlotList<typeof Text | typeof Card | typeof Badge>;
  actions?: ComponentSlotList<typeof Button>;
}

export interface PanelProps {
  title: string;
  slots: PanelSlots;
  children?: never;
}
```

The slot type MUST describe:

- the allowed component definitions;
- whether the slot is required or optional;
- whether it accepts one item or an ordered collection;
- minimum and maximum cardinality when applicable.

Raw text and intrinsic HTML are rejected unless the slot contract explicitly permits them. A broad
`ReactNode` or `ReactElement` type is not a valid Strict UI slot contract because it cannot express the
required allow-list.

The component implementation determines the slot's structural position by rendering the named slot:

```tsx
export function Panel({ title, slots }: PanelProps) {
  return (
    <section aria-label={title}>
      <header>
        {slots.header}
        {slots.actions}
      </header>
      <main>{slots.content}</main>
    </section>
  );
}
```

The caller supplies validated content through the named slot object:

```tsx
<Panel
  title="Overview"
  slots={{
    header: <Heading label="Overview" />,
    content: [<Text value="Status" />, <Card />],
    actions: [<Button label="Save" />],
  }}
/>
```

Design Space MUST validate slot content against the compiler-resolved contract before insertion, after
source changes, and before saving. Invalid existing source MUST be reported against the exact slot and
source location. The editor MUST fail closed: invalid content is never offered as a compatible insertion.

## Source trees and ownership

The IDE presents two related source scopes.

### Main ownership tree

The main tree starts at the configured app entry component and follows the real JSX composition. A local
component placed in this tree has one owner and is used only at that owned position. Code above the owner,
siblings, and unrelated branches MUST NOT import that private component.

```text
App
└── AppShell
    ├── Header
    │   └── UserMenu
    └── Dashboard
        └── ProjectList
```

Here `UserMenu` is private to `Header`, and `ProjectList` is private to `Dashboard`.

### Shared component scope

A component used by multiple independent owners belongs to the smaller, flatter shared component scope.
Shared components conceptually sit above the shell and MAY be imported by any component below that scope.

```text
Shared Components
├── Button
├── EmptyState
└── Modal

AppShell
├── Header
├── Dashboard
└── Settings
```

When a private component gains a second independent consumer, it MUST be promoted to shared scope rather
than imported across ownership branches. A shared component that becomes privately owned SHOULD move back
under its sole owner.

Folder and section labels are navigation aids, not source-tree node kinds. Both scopes still contain only
Component, HTML, and Slot nodes.

## Source layout

The frontend project root owns `.designspace.ts`. Shared components live above the shell's ownership tree;
private components are colocated beneath their sole owner. Device implementations remain explicit.

```text
frontend-project/
├── .designspace.ts
└── src/app/
    ├── components/                 shared scope
    │   ├── Button/
    │   │   ├── desktop.tsx
    │   │   ├── tablet.tsx
    │   │   └── mobile.tsx
    │   └── Modal/
    │       ├── desktop.tsx
    │       └── mobile.tsx
    └── shell/
        ├── desktop/
        │   ├── layout.tsx
        │   └── pages/
        │       └── Dashboard/
        │           ├── Dashboard.tsx
        │           └── ProjectList/
        │               └── ProjectList.tsx
        ├── tablet/
        │   ├── layout.tsx
        │   └── pages/
        └── mobile/
            ├── layout.tsx
            └── pages/
```

Tablet MAY explicitly reuse Desktop or Mobile through `.designspace.ts`. Design Space MUST NOT infer a
fallback. A logical component appears once in navigation while the canvas HUD switches among its explicit
Desktop, Tablet, and Mobile implementations.

## IDE interaction contract

Design Space is an IDE, not a document viewer. Its stable desktop workspace is:

```text
Source explorer | Canvas preview | Monaco code and properties
```

Selection is authoritative and synchronized:

- selecting a Component, HTML, or Slot node highlights the rendered target and its source range;
- selecting the canvas target reveals the same tree node and source range;
- selecting source with an unambiguous binding highlights the same tree and canvas target;
- selecting an internal HTML node never opens a new screen;
- switching Desktop, Tablet, or Mobile changes the implementation, not the workspace;
- opening a component definition is explicit and preserves the previous selection and canvas state.

### Preview, Play, and isolated Design

The canvas has two persistent workspace modes and one temporary runtime state:

```text
Preview · Static ── Play ──> Preview · Live
      │                         │
      └─ open component ──> Design · Isolated
```

`Preview · Static` is the safe default. It MUST render the complete application from the configured entry
root. Selecting any Component, HTML, or Slot in the tree or canvas MUST only change the synchronized
selection and inspector; it MUST NOT replace the canvas root. The target application MUST NOT execute
JavaScript inside the static canvas. Design Space MAY execute a colocated design in its controlled renderer
to produce the snapshot, but it MUST transfer only HTML and CSS into the script-free canvas.

`Preview · Live` is entered only through an explicit Play action. It MAY execute the target UI and deliver
pointer and keyboard input to it. Stop or Escape MUST return to the same static Preview context without
losing tree expansion, selection, device, pan, or zoom. The live state MUST NOT survive reloads or target
changes.

`Design · Isolated` is entered by explicitly opening a Component, normally by double-clicking its tree or
canvas occurrence. The canvas MUST then render only that Component through its colocated `.design.tsx`.
The selected design case supplies typed props and Slots; concrete props from an application occurrence MUST
NOT leak into the isolated design. A single click within the isolated Component selects its Component, HTML,
or Slot layer without changing the design root. Opening a nested Component MAY replace the isolated design
root. Returning to Preview MUST restore the previous Preview selection and canvas state.

Preview and Design MUST remember independent selection and canvas state. The HUD MUST always identify the
current context and provide a direct way to enter Play, stop Play, or return from isolated Design to Preview.
The Source Tree remains available in both workspace modes.

Code edits MUST update the preview immediately. Invalid code MUST keep the last valid preview visible and
show exact diagnostics. Save, undo, redo, reset, stale-source detection, exact diff, and compile recovery
are required IDE behavior, not optional polish.

## No parallel truth

Design Space MUST NOT require or persist a redundant component or slot schema for TypeScript-first targets.
It MUST NOT invent components, props, slots, accepted children, source paths, or application structure.

Legacy adapter and design-document targets MAY remain available during migration, but their JSON contracts
are not the Strict UI source model and MUST NOT constrain the TypeScript-first architecture.

## Conformance

A change conforms to Strict UI only when all applicable statements below are true:

- the visible source structure is derived from compiler-resolved TypeScript and JSX;
- the source tree uses only Component, HTML, and Slot nodes;
- pages, layouts, roots, fragments, and text are not separate node kinds;
- every slot is explicit, named, typed, cardinality-aware, and validated;
- `children` is rejected;
- private component imports respect ownership direction;
- shared components have multiple independent consumers or an explicit public-library role;
- Tree, Canvas, and Code share one selection;
- invalid source cannot be saved as valid Strict UI;
- the target production build contains no Design Space runtime or editor code.

Tests and reviews SHOULD reference the relevant section of this document when proving or rejecting
conformance. Changes to this constitution require an explicit product decision; implementation drift is
not a valid reason to weaken it.
