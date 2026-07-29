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

Review and signing happen outside Design Space:

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

Signing uses the Project approval authority and its authenticated device flow.
Design Space only refreshes and visualizes the resulting verified state.
