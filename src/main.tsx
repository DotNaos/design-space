import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { applyStoredDesignSpaceTheme } from "./app/shell/design-space-theme";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Design Space root element is missing.");
applyStoredDesignSpaceTheme();

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
