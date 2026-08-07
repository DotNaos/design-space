// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { CatalogFolderIcon } from "./CatalogFolderIcon";

it("shows the npm package marker alongside the folder icon", () => {
  render(<CatalogFolderIcon isPackage />);

  expect(screen.getByLabelText("npm package")).toBeInTheDocument();
});
