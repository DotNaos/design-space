import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceChangeReviewModal } from "./SourceChangeReviewModal";
import type { SourceChangeReviewItem } from "./source-change-review";

afterEach(cleanup);

vi.mock("./MonacoSourceDiff", () => ({
  MonacoSourceDiff: (props: { mode: string; modified: string; original: string; path: string }) => (
    <div aria-label="Source diff editor" data-mode={props.mode} data-path={props.path}>
      <pre aria-label="Before source">{props.original}</pre>
      <pre aria-label="After source">{props.modified}</pre>
      <span>Highlighted synchronized diff</span>
    </div>
  ),
}));

vi.mock("./MonacoReviewSource", () => ({
  MonacoReviewSource: (props: { ariaLabel: string; path: string; value: string }) => (
    <pre aria-label={props.ariaLabel} data-path={props.path}>{props.value}</pre>
  ),
}));

const buttonChange = change({
  id: "button",
  digest: "button:v1",
  label: "Button.tsx",
  path: "packages/react-ui/src/Button.tsx",
  beforeSource: "export function Button() { return <button>Save</button>; }",
  afterSource: "export function Button() { return <button className=\"rounded\">Save</button>; }",
});

const cardChange = change({
  id: "card",
  digest: "card:v1",
  label: "Card.tsx",
  path: "packages/react-ui/src/Card.tsx",
  beforeSource: "export function Card() { return <section />; }",
  afterSource: "export function Card() { return <section className=\"p-4\" />; }",
});

describe("SourceChangeReviewModal", () => {
  it("shows the approval checklist and applies only selected, approved, valid changes", async () => {
    const onApply = vi.fn();
    renderReview({ changes: [buttonChange, cardChange], onApply });

    expect(await screen.findByRole("dialog", { name: "Review changes" })).toBeInTheDocument();
    expect(screen.getByText("0 of 2 approved · 2 selected")).toBeVisible();
    expect(screen.getByRole("region", { name: "Before preview" })).toHaveTextContent("Button before");
    expect(screen.getByRole("region", { name: "After preview" })).toHaveTextContent("Button after");
    const before = screen.getByRole("region", { name: "Before change" });
    const after = screen.getByRole("region", { name: "After change" });
    expect(await within(before).findByLabelText("Before source")).toHaveTextContent("<button>Save</button>");
    expect(within(after).getByLabelText("After source")).toHaveTextContent("className=\"rounded\"");
    expect(within(before).getByRole("region", { name: "Before preview" })).toHaveTextContent("Button before");
    expect(within(after).getByRole("region", { name: "After preview" })).toHaveTextContent("Button after");

    const apply = screen.getByRole("button", { name: "Apply selected (2)" });
    expect(apply).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Approve Button.tsx" }));
    expect(screen.getByText("1 of 2 approved · 2 selected")).toBeVisible();
    expect(apply).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Card\.tsx/ }));
    expect(screen.getByRole("region", { name: "After preview" })).toHaveTextContent("Card after");
    await userEvent.click(screen.getByRole("checkbox", { name: "Approve Card.tsx" }));
    expect(apply).toBeEnabled();
    await userEvent.click(apply);

    expect(onApply).toHaveBeenCalledWith([buttonChange, cardChange]);
  });

  it("resets approval when the current digest changes", async () => {
    const onReviewStateChange = vi.fn();
    const view = renderReview({ changes: [buttonChange], onReviewStateChange });

    const approval = await screen.findByRole("checkbox", { name: "Approve Button.tsx" });
    await userEvent.click(approval);
    expect(approval).toBeChecked();
    expect(screen.getByRole("button", { name: "Apply selected (1)" })).toBeEnabled();

    view.rerender(
      <SourceChangeReviewModal
        changes={[{ ...buttonChange, digest: "button:v2", after: { ...buttonChange.after, source: `${buttonChange.after.source}\n// latest` } }]}
        open
        onApply={() => undefined}
        onClose={() => undefined}
        onReviewStateChange={onReviewStateChange}
      />,
    );

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Approve Button.tsx" })).not.toBeChecked());
    expect(screen.getByText("0 of 1 approved · 1 selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply selected (1)" })).toBeDisabled();
    expect(onReviewStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      button: { approved: false, digest: "button:v2", included: true },
    }));
  });

  it("keeps a persisted approval that hydrates while review is closed", async () => {
    const onReviewStateChange = vi.fn();
    const approvedState = {
      button: { approved: true, digest: buttonChange.digest, included: true },
    };
    const view = render(
      <SourceChangeReviewModal
        changes={[]}
        open={false}
        onApply={() => undefined}
        onClose={() => undefined}
        onReviewStateChange={onReviewStateChange}
      />,
    );

    view.rerender(
      <SourceChangeReviewModal
        changes={[buttonChange]}
        initialState={approvedState}
        open={false}
        onApply={() => undefined}
        onClose={() => undefined}
        onReviewStateChange={onReviewStateChange}
      />,
    );
    expect(onReviewStateChange).not.toHaveBeenCalled();

    view.rerender(
      <SourceChangeReviewModal
        changes={[buttonChange]}
        initialState={approvedState}
        open
        onApply={() => undefined}
        onClose={() => undefined}
        onReviewStateChange={onReviewStateChange}
      />,
    );

    expect(await screen.findByRole("checkbox", { name: "Approve Button.tsx" })).toBeChecked();
    expect(screen.getByText("1 of 1 approved · 1 selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply selected (1)" })).toBeEnabled();
    await waitFor(() => expect(onReviewStateChange).toHaveBeenLastCalledWith(approvedState));
  });

  it("keeps an exact-version approval while that version is revalidating", async () => {
    const approvedState = {
      button: { approved: true, digest: buttonChange.digest, included: true },
    };
    const validatingChange = {
      ...buttonChange,
      valid: false,
      validationMessage: "Validating this draft.",
    };
    const view = renderReview({ changes: [validatingChange], initialState: approvedState });

    expect(await screen.findByRole("checkbox", { name: "Approve Button.tsx" })).toBeChecked();
    expect(screen.getByText("1 of 1 approved · 1 selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply selected (1)" })).toBeDisabled();

    view.rerender(
      <SourceChangeReviewModal
        changes={[buttonChange]}
        initialState={approvedState}
        open
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Approve Button.tsx" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Apply selected (1)" })).toBeEnabled();
  });

  it("lets the reviewer exclude an invalid change and apply the valid approved subset", async () => {
    const invalidCard = { ...cardChange, valid: false, validationMessage: "Card.tsx does not compile." };
    const onApply = vi.fn();
    renderReview({ changes: [buttonChange, invalidCard], onApply });

    expect(await screen.findByRole("checkbox", { name: "Approve Card.tsx" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Approve Button.tsx" }));
    expect(screen.getByRole("button", { name: "Apply selected (2)" })).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: "Include Card.tsx" }));
    const apply = screen.getByRole("button", { name: "Apply selected (1)" });
    expect(apply).toBeEnabled();
    await userEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith([buttonChange]);
  });

  it("stacks before and after on narrow screens before switching to desktop columns", async () => {
    renderReview({ changes: [buttonChange] });
    expect(await screen.findByTestId("source-change-comparison-grid")).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-2",
    );
  });

  it("keeps each source directly below its matching preview", async () => {
    renderReview({ changes: [buttonChange] });

    const before = await screen.findByRole("region", { name: "Before change" });
    const after = screen.getByRole("region", { name: "After change" });
    expect(within(before).getByRole("region", { name: "Before preview" })).toBeVisible();
    expect(within(before).getByLabelText("Before source")).toBeVisible();
    expect(within(after).getByRole("region", { name: "After preview" })).toBeVisible();
    expect(within(after).getByLabelText("After source")).toBeVisible();
  });

  it("switches between paired previews, split diff, and unified diff", async () => {
    renderReview({ changes: [buttonChange] });

    expect(await screen.findByRole("region", { name: "Before change" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Split diff" }));
    const split = await screen.findByRole("region", { name: "Split source diff" });
    expect(await within(split).findByLabelText("Source diff editor")).toHaveAttribute("data-mode", "split");
    expect(screen.queryByRole("region", { name: "Before change" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Unified diff" }));
    const unified = await screen.findByRole("region", { name: "Unified source diff" });
    expect(await within(unified).findByLabelText("Source diff editor")).toHaveAttribute("data-mode", "unified");

    await userEvent.click(screen.getByRole("button", { name: "Before / after" }));
    expect(await screen.findByRole("region", { name: "Before change" })).toBeVisible();
  });

  it("locks review and discard controls while changes are being applied", async () => {
    renderReview({ applying: true, onDiscard: vi.fn() });

    expect(await screen.findByRole("checkbox", { name: "Include Button.tsx" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Button\.tsx/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Approve Button.tsx" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard Button.tsx" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep editing" })).toBeDisabled();
  });

  it("can persist checklist state in its parent without entering an update loop", async () => {
    const onApply = vi.fn();
    function ControlledReview() {
      const [reviewState, setReviewState] = useState({});
      return (
        <SourceChangeReviewModal
          changes={[buttonChange]}
          initialState={reviewState}
          open
          onApply={onApply}
          onClose={() => undefined}
          onReviewStateChange={setReviewState}
        />
      );
    }

    render(<ControlledReview />);
    const approval = await screen.findByRole("checkbox", { name: "Approve Button.tsx" });
    await userEvent.click(approval);
    await waitFor(() => expect(approval).toBeChecked());
    expect(screen.getByRole("button", { name: "Apply selected (1)" })).toBeEnabled();
  });
});

function renderReview(overrides: Partial<React.ComponentProps<typeof SourceChangeReviewModal>> = {}) {
  return render(
    <SourceChangeReviewModal
      changes={[buttonChange]}
      open
      onApply={() => undefined}
      onClose={() => undefined}
      {...overrides}
    />,
  );
}

function change(input: {
  afterSource: string;
  beforeSource: string;
  digest: string;
  id: string;
  label: string;
  path: string;
}): SourceChangeReviewItem {
  return {
    after: { preview: <button>{input.label.replace(".tsx", "")} after</button>, source: input.afterSource },
    before: { preview: <button>{input.label.replace(".tsx", "")} before</button>, source: input.beforeSource },
    digest: input.digest,
    id: input.id,
    label: input.label,
    path: input.path,
    repository: "@dotnaos/react-ui",
    valid: true,
  };
}
