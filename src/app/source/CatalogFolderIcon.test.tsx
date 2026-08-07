// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { CatalogFolderIcon } from "./CatalogFolderIcon";

it("shows the npm package marker without a folder icon", () => {
  render(<CatalogFolderIcon isPackage />);

  expect(screen.getByLabelText("npm package")).toBeInTheDocument();
  expect(document.querySelector("svg.lucide-folder")).not.toBeInTheDocument();
});
