import React from "react";
import { createRoot } from "react-dom/client";
import { Card } from "./Card";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <Card
      header={[<h1 key="title">Remote design review</h1>]}
      body={[<p key="copy">The same target component in its production entry.</p>]}
    />,
  );
}
