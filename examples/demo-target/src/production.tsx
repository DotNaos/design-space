import React from "react";
import { createRoot } from "react-dom/client";
import { ProductionApp } from "./production-renderer";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<ProductionApp />);
}
