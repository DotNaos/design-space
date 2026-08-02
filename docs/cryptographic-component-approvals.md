# Cryptographic component approvals

Design Space can display the approval state of every indexed component directly in
the Source Tree. The tree is still the normal source tree: approval mode only adds
a compact status beside each component so it works like a review checklist.

Design Space does not create approval truth. It only displays evidence verified by
the signed Project CLI. A browser toggle, local storage value, or unsigned draft can
never make a component approved.

## Configuration

The frontend project's `.designspace.ts` opts into a repository-owned approval
policy:

```ts
export default {
  project: {
    id: "design-space",
    label: "Design Space",
  },
  approvals: {
    policy: ".project/approvals/policy.yaml",
  },
};
```

The external trust root is deliberately not stored in `.designspace.ts`. Start the
development server with `PROJECT_APPROVAL_TRUST_ROOT` pointing to the enrolled
trust root outside the repository.

Each indexed component maps to one stable policy scope:

```txt
component:<project-relative-source-path>#<export-name>
```

For example:

```txt
component:src/app/components/Button.tsx#Button
```

That scope ID belongs in the Project approval policy. Multiple component exports
from one source file remain separate review scopes because the export name is part
of the ID.

## Source contract and derived review material

The component's compiler-resolved TypeScript props type is the only property and Slot contract. Normal
properties remain normal props. Structural inputs live under the typed `slots` property and declare their
allowed component definitions, requiredness, collection shape, and finite cardinality. Strict UI leaf
components declare an explicit empty Slot contract. Components do not contain approval hashes, signature
metadata, or a separately authored manifest.

Design Space may generate a compact contract snapshot under `.project/approvals/drafts/` beside the existing
review and quality-gate evidence. A snapshot contains only deterministic compiler-derived facts, for example:

```json
{
  "version": 1,
  "scopeId": "component:src/app/Layout.tsx#Layout",
  "source": { "path": "src/app/Layout.tsx", "exportName": "Layout" },
  "props": [
    { "name": "density", "required": false, "type": "comfortable | compact" }
  ],
  "slots": [
    {
      "name": "main",
      "min": 1,
      "max": 1,
      "accepts": [
        "component:src/app/DashboardMain.tsx#DashboardMain",
        "component:src/app/EditorMain.tsx#EditorMain"
      ]
    }
  ]
}
```

The generator sorts all properties, Slots, and accepted component identities deterministically. Before
review or signing it regenerates the snapshot in memory and requires an exact match with the stored file.
The snapshot never overrides TypeScript: a missing or different snapshot is stale review material, and a
manually edited snapshot cannot make incompatible source valid.

The approval policy scope includes the component source and its current derived snapshot. It may also
include the colocated `.design.tsx`, unsigned review decisions, and referenced visual or automated evidence.
The existing Project approval attestation then binds the exact scoped file list and hashes, repository,
policy, component scope, signer, and issue time. Source files therefore stay close to normal React code;
hashes and signatures remain entirely in the approval sidecars.

Structural validation and signature verification are separate gates:

1. Strict UI validates the current source tree top-down against its source-defined Slot contracts.
2. The derived snapshot is regenerated and checked against that compiler result.
3. The static component review loop in [`design-review-graph.md`](./design-review-graph.md) is completed for
   the exact source revision.
4. The Project CLI verifies or creates the signed attestation for the complete scoped evidence.

A valid signature does not make structurally invalid source valid. Structurally valid but unsigned source is
conforming, not approved. Any source, contract snapshot, review evidence, policy, scope, or signer mismatch
fails closed as missing, stale, invalid, unreviewed, or unavailable evidence.

## Visible states

- **Approved** — the external verifier confirms that the signed content is current.
- **Awaiting approval** — the policy scope exists but has no valid signature.
- **Changed after approval** — the component changed after it was signed.
- **Invalid** — the signature or its trust evidence is invalid.
- **Unreviewed** — the component has no policy scope, or approvals are not configured.
- **Verification unavailable** — the policy is configured but trusted verification
  could not run.

Every error fails closed. Design Space never turns missing or unavailable evidence
into an approval.

## Signing

Design Space may start this exact one-component signing operation through its local server. The server derives
the repository root, policy, trust root, and component scope from its trusted registration; the browser sends
only the opaque ID of the currently registered component. The equivalent direct CLI operations are:

```sh
project approval status \
  --root /path/to/project \
  --policy .project/approvals/policy.yaml \
  --trust-root /path/outside/repository/trust.json

project approval sign \
  --root /path/to/project \
  --policy .project/approvals/policy.yaml \
  --trust-root /path/outside/repository/trust.json \
  --scope 'component:src/app/components/Button.tsx#Button'
```

Signing uses the Project approval authority and its authenticated device flow. Each invocation signs exactly
one component scope and therefore creates one human checkpoint. Design Space refreshes and visualizes the
resulting verified state; it never batches scopes or treats aggregate app progress as a signature.
