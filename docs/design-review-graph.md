# Static design review graph

This document is the canonical human-review workflow for Design Space. It explains what the reviewer looks
at, how the review moves through a complete app, and how each component becomes its own signed checkpoint.

Design Space is built for one central workflow: an LLM produces a UI, a human reviews the visual result,
comments when it is wrong, and approves it when it is right.

## The component graph

The app is reviewed as a graph of components:

```text
Properties ──> [ Component in one visual state ] ──> Slots ──> Child components
```

- **Properties** are the design inputs that visibly change the component.
- **States** are the component's finite declared visual forms, such as `default`, `selected`, `disabled`, or
  `loading`.
- **Slots** are the outgoing edges to the next components in the app graph.

JSX supplies Slot content to a parent component. The review UI deliberately presents Slots as outgoing
edges because they are how the reviewer continues through the app.

## The review loop

Every component uses the same short loop:

1. **Properties** — inspect only the property variations that visibly change the design.
2. **States** — inspect the default design and every explicitly declared visual state.
3. **Slots** — inspect every Slot, its current child, and its allowed alternative component types.
4. **Verify** — sign this component or attach a comment and return it to the LLM.
5. **Continue** — open the next occupied Slot and repeat the loop for its current child.

This is a static design review of styled HTML. Runtime behavior, accessibility, source files, and automatic
validation are not additional human review steps. They may still be checked elsewhere and invalid or stale
evidence cannot be approved.

## Finite review cases

The reviewer does not inspect every possible combination of arbitrary property values. The component design
declares a finite set of meaningful visual cases. These include the default case, explicitly named States,
and only the Property variations that materially change the visual result.

A State may use different Slot children. Each such State therefore creates its own outgoing path through the
current app graph.

```text
[ Root ]
├─ default
│  └─ layout ──> [ PublicLayout ]
└─ signed-in
   └─ layout ──> [ AccountLayout ]
```

## Traversing a whole app

The reviewer first chooses an explicit device path. Desktop, Tablet, and Mobile may have separate roots.
Explicit source reuse does not create duplicate work.

```text
App review
├─ Desktop ──> [ Root ]
├─ Tablet ───> explicit implementation or reuse
└─ Mobile ───> [ MobileRoot ]
```

Within one device path, Design Space walks depth-first:

```text
[ Root ]
   ├─ Properties
   ├─ States
   └─ Slots
       └─ layout ──> [ Layout ]
                         ├─ Properties
                         ├─ States
                         └─ Slots
                             ├─ sidebar ──> [ Sidebar ]
                             └─ main ─────> [ Main ]
```

The practical traversal is:

1. Open the device root.
2. Review its Properties, States, and Slots.
3. Open the first occupied Slot.
4. Repeat the same loop for its current child.
5. At a leaf, sign that component and walk back to the nearest component with an unreviewed occupied Slot.
6. Continue until every current State and occupied Slot path has been visited.

An unused but allowed Slot type remains visible as an alternative. It is part of the parent's contract, but
it is not traversed as part of the current app until it is actually used.

## Shared components

A shared component definition is reviewed once. Every occurrence points to that reviewed definition instead
of creating a duplicate definition review. Design Space still shows each occurrence in its parent context so
the reviewer can understand the current composition.

## Completion and component checkpoints

A component's own visual result can be signed before its children. Its subtree is complete only when every
currently reachable component has its own current signature.

```text
Component reviewed
    ↓
Component signed with one authenticated checkpoint
    ↓
Continue through the next occupied Slot
    ↓
Device and app progress update from the individual signatures
```

The whole app is complete only when every reachable component on every configured device path has its own
current signature. Parent, device, and app completion are aggregate progress indicators, not additional
signatures and not substitutes for a missing child signature.

The per-component signed attestation remains the approval truth. A local checkbox, unsigned browser state,
or single root/application signature can never make other components approved.

## Design Space presentation

The Canvas is the primary review surface. Its fixed header shows:

- the selected device path;
- the root-to-current component path;
- the current component;
- compact controls for Properties, States, and Slots.

These controls stay outside the Canvas transform so zooming and panning cannot move them out of reach.

The fixed footer contains the primary decisions:

- comment and return the current result to the LLM;
- sign this component with one authenticated checkpoint;
- continue to the next component.

A comment remains attached to the exact component, Property selection, State, Slot, and source revision. A
new affected revision makes that review result stale and sends the component back through the same loop.

## Relationship to the source contract

[`../STRICT_UI.md`](../STRICT_UI.md) defines how TypeScript Properties, finite named Slots, ownership, and
component identity create this graph. The TypeScript and JSX source remains the only structural truth.
Generated review material may describe the graph, but it cannot invent or override it.

[`cryptographic-component-approvals.md`](./cryptographic-component-approvals.md) defines how the exact source,
derived review material, and human evidence become externally verifiable approval.
