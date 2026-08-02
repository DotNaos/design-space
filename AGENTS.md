# Design Space agent instructions

After claiming your agent identity and before planning, inspecting, reviewing, or changing Design Space,
read all of the following on every new task, even if you read them in a previous task:

1. The **Core workflow** section in [`README.md`](./README.md).
2. [`docs/design-review-graph.md`](./docs/design-review-graph.md) completely. It is the canonical static
   design-review workflow and the core product concept.
3. [`STRICT_UI.md`](./STRICT_UI.md) completely. It is the canonical component, Slot, source, and IDE
   architecture contract.

Do not rely on memory, a previous task summary, or current implementation behavior instead of rereading
these files. For work involving review state, signatures, or component approval, also read
[`docs/cryptographic-component-approvals.md`](./docs/cryptographic-component-approvals.md) completely.

Any intended change to these contracts requires an explicit product decision. Do not silently turn an
implementation gap into a new rule.
