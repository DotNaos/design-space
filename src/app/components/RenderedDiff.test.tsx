import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { parseUnifiedDiff, RenderedDiff } from "./RenderedDiff";

const diff = `diff --git a/src/Card.tsx b/src/Card.tsx
--- a/src/Card.tsx
+++ b/src/Card.tsx
@@ -4,2 +4,2 @@
-  className="p-4"
+  className="p-6"
 context
diff --git a/src/theme.css b/src/theme.css
--- a/src/theme.css
+++ b/src/theme.css
@@ -1 +1 @@
-.old {}
+.new {}`;

describe("RenderedDiff", () => {
  it("preserves exact diff lines and calculates old/new line numbers", () => {
    const files = parseUnifiedDiff(diff);
    expect(files.map((file) => file.label)).toEqual(["src/Card.tsx", "src/theme.css"]);
    expect(files[0]?.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "remove", oldLine: 4, text: '-  className="p-4"' }),
      expect.objectContaining({ kind: "add", newLine: 4, text: '+  className="p-6"' }),
      expect.objectContaining({ kind: "context", oldLine: 5, newLine: 5, text: " context" }),
    ]));
  });

  it("renders changed-file tabs and switches without hiding exact text semantically", async () => {
    render(<RenderedDiff diff={diff} />);
    expect(screen.getByRole("region", { name: "Source diff, scroll in both directions" })).toHaveTextContent('className="p-6"');
    await userEvent.click(screen.getByRole("tab", { name: "src/theme.css" }));
    expect(screen.getByRole("region", { name: "Source diff, scroll in both directions" })).toHaveTextContent(".new {}");
  });
});
