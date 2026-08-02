import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { AppClerkProvider } from "./auth/clerk-provider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppClerkProvider>
      <App />
    </AppClerkProvider>
  </StrictMode>,
);
