// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_INPUT_LENGTH } from "../constants/input.const";
import { NON_JAPANESE_INPUT_ERROR } from "../constants/furigana.const";

type ActionData = {
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

    screen.getByText(`5 / ${MAX_INPUT_LENGTH.toLocaleString()}`);
  });

  it("marks counter as danger at the max length", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "あ".repeat(MAX_INPUT_LENGTH) } });

    const counter = screen.getByText(
      `${MAX_INPUT_LENGTH.toLocaleString()} / ${MAX_INPUT_LENGTH.toLocaleString()}`,
    );
    expect(counter.getAttribute("data-state")).toBe("danger");
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

  it("renders non-Japanese validation message and restores original input", () => {
    mockUseActionData.mockReturnValue({
      error: NON_JAPANESE_INPUT_ERROR,
      originalText: "hello and にほんご",
    });
    render(<Home />);

    expect(screen.getByRole("alert").textContent).toContain(NON_JAPANESE_INPUT_ERROR);
    expect(getTextarea().value).toBe("hello and にほんご");
  });

  it("uses a submit button and enables it for valid input", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "日本語" } });

    const submitButton = getSubmitButton();
    expect(submitButton.getAttribute("type")).toBe("submit");
    expect(submitButton.hasAttribute("disabled")).toBe(false);
  });

  it("submits the form via Cmd+Enter and Ctrl+Enter", () => {
    render(<Home />);
    fireEvent.change(getTextarea(), { target: { value: "日本語" } });

    const requestSubmitSpy = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);

    fireEvent.keyDown(getTextarea(), { key: "Enter", metaKey: true });
    fireEvent.keyDown(getTextarea(), { key: "Enter", ctrlKey: true });

    expect(requestSubmitSpy).toHaveBeenCalledTimes(2);
    requestSubmitSpy.mockRestore();
  });

  it("shows loading label and spinner while submitting", () => {
    mockUseNavigation.mockReturnValue({ state: "submitting", formMethod: "POST" });
    render(<Home />);

    expect(getSubmitButton().textContent).toContain("Generating…");
    expect(screen.getByRole("status").textContent).toContain("Generating…");
  });
});
