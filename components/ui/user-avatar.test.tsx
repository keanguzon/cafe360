// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { UserAvatar } from "./user-avatar";

let node: HTMLDivElement;
let root: Root;
const render = (src?: string | null, name = "Ana Cruz") => act(() => root.render(<UserAvatar src={src} name={name}/>));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  node = document.createElement("div"); document.body.append(node); root = createRoot(node);
});
afterEach(() => { act(() => root.unmount()); node.remove(); });

it("uses_local_initials_without_a_remote_placeholder_request", () => {
  render(null); expect(node.textContent).toBe("AC"); expect(node.querySelector("img")).toBeNull();
  expect(node.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Ana Cruz");
  render(null, "   "); expect(node.textContent).toBe("U");
});
it("falls_back_on_image_failure_and_loads_a_changed_source", () => {
  render("https://example.com/first.jpg");
  expect(node.querySelector("img")?.getAttribute("src")).toBe("https://example.com/first.jpg");
  act(() => node.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(node.querySelector("img")).toBeNull(); expect(node.textContent).toBe("AC");
  render("https://example.com/new.jpg");
  expect(node.querySelector("img")?.getAttribute("src")).toBe("https://example.com/new.jpg");
  render(null, "Ben Diaz"); expect(node.querySelector("img")).toBeNull(); expect(node.textContent).toBe("BD");
});
