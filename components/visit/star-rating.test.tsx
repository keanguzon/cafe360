// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StarRating } from "./star-rating";

describe("StarRating", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  function renderRating(
    rating: number | null,
    onChange = vi.fn(),
    readOnly = false,
  ) {
    act(() => {
      root?.render(
        <StarRating rating={rating} onChange={onChange} readOnly={readOnly} />,
      );
    });

    return {
      buttons: Array.from(container.querySelectorAll("button")),
      onChange,
    };
  }

  it("names every star and marks only the exact selected value as pressed", () => {
    const { buttons } = renderRating(3);

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Rate 1 out of 5 stars",
      "Rate 2 out of 5 stars",
      "Rate 3 out of 5 stars",
      "Rate 4 out of 5 stars",
      "Rate 5 out of 5 stars",
    ]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ]);
    expect(buttons[2]?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps each rating keyboard-focusable and activates the focused rating", () => {
    const { buttons, onChange } = renderRating(null);
    const button = buttons[3] as HTMLButtonElement;

    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.type).toBe("button");

    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    const defaultActionAllowed = button.dispatchEvent(keydown) && !keydown.defaultPrevented;
    if (defaultActionAllowed) button.click();

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("updates the rating when clicked", () => {
    const { buttons, onChange } = renderRating(null);

    act(() => {
      buttons[4]?.click();
    });

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("disables all rating buttons in read-only mode", () => {
    const { buttons, onChange } = renderRating(2, vi.fn(), true);

    expect(buttons).toHaveLength(5);
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      (buttons[4] as HTMLButtonElement).click();
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
