// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_INPUT_LENGTH } from "../constants/input";
import type { FuriganaToken } from "../schema/furigana";

type ActionData =
  | {
      tokens: FuriganaToken[];
    }
  | {
      error: string;
      originalText: string;
    };

const { mockUseActionData, mockUseNavigation } = vi.hoisted(() => ({
  mockUseActionData: vi.fn<() => ActionData | undefined>(),
  mockUseNavigation: vi.fn<() => { state: string; formMethod: string | undefined }>(() => ({
    state: "idle",
    formMethod: undefined,
  })),
}));

vi.mock("react-router", async () => {
  return {
    Form: React.forwardRef<HTMLFormElement, React.ComponentProps<"form">>(
      function MockForm(props, ref) {
        return <form ref={ref} {...props} />;
      },
    ),
    useActionData: () => mockUseActionData(),
    useNavigation: () => mockUseNavigation(),
    UNSAFE_withComponentProps: <T,>(component: React.ComponentType<T>) => component,
  };
});

vi.mock("~/components/furigana/ReadingView", () => ({
  ReadingView: ({ tokens }: { tokens: FuriganaToken[] }) => (
    <div data-testid="reading-view">ReadingView tokens: {tokens.length}</div>
  ),
}));

vi.mock("~/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));

vi.mock("~/components/ui/textarea", () => ({
  Textarea: (props: React.ComponentProps<"textarea">) => <textarea {...props} />,
}));

import Home from "./home";

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText("Japanese text input");
}

function getSubmitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /generate furigana|generating…/i });
}

describe("home route component", () => {
  beforeEach(() => {
    mockUseActionData.mockReset();
    mockUseNavigation.mockReset();
    mockUseActionData.mockReturnValue(undefined);
    mockUseNavigation.mockReturnValue({ state: "idle", formMethod: undefined });
  });

  it("updates the counter when textarea changes", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "こんにちは" } });

    expect(screen.getByText(`5 / ${MAX_INPUT_LENGTH.toLocaleString()}`)).not.toBeNull();
  });

  it("shows destructive counter color at the max length", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "あ".repeat(MAX_INPUT_LENGTH) } });

    const counter = screen.getByText(
      `${MAX_INPUT_LENGTH.toLocaleString()} / ${MAX_INPUT_LENGTH.toLocaleString()}`,
    );
    expect(counter.className.includes("text-destructive")).toBe(true);
  });

  it("disables submit button on initial load", () => {
    render(<Home />);
    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("disables submit button when action data contains over-limit text", () => {
    mockUseActionData.mockReturnValue({
      error: "Text exceeds limit.",
      originalText: "あ".repeat(MAX_INPUT_LENGTH + 1),
    });
    render(<Home />);

    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("renders error alert and restores text", () => {
    mockUseActionData.mockReturnValue({
      error: "Something went wrong",
      originalText: "日本語",
    });
    render(<Home />);

    expect(screen.getByRole("alert").textContent).toContain("Something went wrong");
    expect(getTextarea().value).toBe("日本語");
  });

  it("renders ReadingView when action succeeds", () => {
    mockUseActionData.mockReturnValue({
      tokens: [{ type: "ruby", kanji: "日本語", yomi: "にほんご" }],
    });
    render(<Home />);

    expect(screen.getByTestId("reading-view")).not.toBeNull();
    expect(screen.queryByLabelText("Japanese text input")).toBeNull();
  });

  it("submits the form on button click", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "日本語" } });

    const form = getTextarea().closest("form");
    if (form === null) throw new Error("Expected form element.");

    const submitListener = vi.fn((event: SubmitEvent) => event.preventDefault());
    form.addEventListener("submit", submitListener);

    fireEvent.click(getSubmitButton());

    expect(submitListener).toHaveBeenCalledTimes(1);
  });

  it("submits the form via Cmd+Enter and Ctrl+Enter", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "日本語" } });

    const requestSubmitSpy = vi.spyOn(HTMLFormElement.prototype, "requestSubmit");

    fireEvent.keyDown(getTextarea(), { key: "Enter", metaKey: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", ctrlKey: true });

    expect(requestSubmitSpy).toHaveBeenCalledTimes(2);
    requestSubmitSpy.mockRestore();
  });

  it("shows loading label and spinner while submitting", () => {
    mockUseNavigation.mockReturnValue({ state: "submitting", formMethod: "POST" });
    render(<Home />);

    expect(getSubmitButton().textContent).toContain("Generating…");
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });
});
