import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { registration as demoRegistration } from "../../examples/demo-target/design-space.server";
import { EditService } from "./edit-service";
import { registerTrustedTarget, type TrustedTargetConfig } from "./target-registration";

it("returns completions from the official server using the target's installed Tailwind", async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../examples/demo-target");
  const target = await registerTrustedTarget({ ...demoRegistration, root } as TrustedTargetConfig);
  const service = new EditService(target);
  try {
    const result = await service.execute({ type: "analyze-tailwind", value: "grid-cols-", cursor: 10 });
    expect(result).toMatchObject({ engineVersion: "0.14.29", value: "grid-cols-" });
    expect("completions" in result ? result.completions.map((item) => item.insertText) : [])
      .toContain("grid-cols-1");
    const targetToken = await service.execute({ type: "analyze-tailwind", value: "bg-workspace-", cursor: 13 });
    expect("completions" in targetToken ? targetToken.completions.map((item) => item.insertText) : [])
      .toContain("bg-workspace-accent");
    const conflict = await service.execute({ type: "analyze-tailwind", value: "p-4 p-6", cursor: 7 });
    expect("diagnostics" in conflict ? conflict.diagnostics : []).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "cssConflict", severity: "warning" }),
    ]));
    const quoted = await service.execute({
      type: "analyze-tailwind",
      value: "before:content-['hello']",
      cursor: "before:content-['hello']".length,
    });
    expect(quoted).toMatchObject({ value: "before:content-['hello']" });
  } finally {
    service.dispose();
  }
}, 60_000);
