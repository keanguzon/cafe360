"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type ModalEntry = {
  id: symbol;
  parentId: symbol | null;
  node: HTMLElement;
  opener: HTMLElement | null;
  close: () => void;
  lastFocused: HTMLElement | null;
  historyToken: string | null;
  previousToken: string | null;
  url: string;
  historyConsumed: boolean;
};

const stack: ModalEntry[] = [];
const blocked = new Map<HTMLElement, boolean>();
const historyTokens = new Set<string>();
const modalHistoryKey = "__cafe360ModalHistory";
let nextHistoryToken = 0;
let historyFlushQueued = false;
let programmaticPopPending = false;
const ModalParent = createContext<{ id: symbol; depth: number } | null>(null);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function top(): ModalEntry | undefined {
  return stack[stack.length - 1];
}

function currentHistoryToken(): string | null {
  const token = window.history.state?.[modalHistoryKey];
  return typeof token === "string" ? token : null;
}

function pushModalHistory(entry: ModalEntry) {
  const previous = currentHistoryToken();
  const token = `cafe360-modal-${++nextHistoryToken}`;
  const state = window.history.state;
  window.history.pushState({
    ...(state && typeof state === "object" ? state : {}),
    [modalHistoryKey]: token,
  }, "", window.location.href);
  historyTokens.add(token);
  entry.previousToken = previous;
  entry.historyToken = token;
  entry.url = window.location.href;
  entry.historyConsumed = false;
}

function queueHistoryFlush() {
  if (historyFlushQueued) return;
  historyFlushQueued = true;
  queueMicrotask(() => {
    historyFlushQueued = false;
    if (programmaticPopPending) return;
    for (const entry of stack) {
      if (!entry.historyToken && !entry.historyConsumed) pushModalHistory(entry);
    }
  });
}

function onPopState() {
  const token = currentHistoryToken();
  if (programmaticPopPending) {
    if (token && historyTokens.has(token) && !stack.some((entry) => entry.historyToken === token)) {
      window.history.back();
      return;
    }
    programmaticPopPending = false;
    queueHistoryFlush();
    if (!stack.length) window.removeEventListener("popstate", onPopState);
    return;
  }
  const entry = top();
  if (!entry?.historyToken || window.location.href !== entry.url ||
      token !== entry.previousToken) return;
  entry.historyConsumed = true;
  entry.historyToken = null;
  entry.close();
  window.setTimeout(() => {
    if (stack.includes(entry) && entry.historyConsumed &&
        window.location.href === entry.url && !programmaticPopPending) {
      entry.historyConsumed = false;
      queueHistoryFlush();
    }
  }, 0);
}

function focusable(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) =>
    !item.hasAttribute("inert") && item.getAttribute("aria-hidden") !== "true" &&
    !item.hidden && getComputedStyle(item).display !== "none",
  );
}

function focusFirst(entry: ModalEntry) {
  const target = entry.lastFocused?.isConnected && entry.node.contains(entry.lastFocused)
    ? entry.lastFocused
    : focusable(entry.node)[0] ?? entry.node;
  if (!target.hasAttribute("tabindex") && target === entry.node) target.tabIndex = -1;
  target.focus();
}

function updateInert() {
  for (const [node, wasInert] of blocked) node.inert = wasInert;
  blocked.clear();
  const entry = top();
  if (!entry) return;
  let child: Element = entry.node;
  while (child.parentElement) {
    for (const sibling of child.parentElement.children) {
      if (sibling === child || !(sibling instanceof HTMLElement)) continue;
      if (!blocked.has(sibling)) blocked.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    child = child.parentElement;
  }
}

function onKeyDown(event: KeyboardEvent) {
  const entry = top();
  if (!entry) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    entry.close();
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusable(entry.node);
  if (!items.length) {
    event.preventDefault();
    entry.node.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && (document.activeElement === first || !entry.node.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !entry.node.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

function onFocusIn(event: FocusEvent) {
  const entry = top();
  if (!entry) return;
  const target = event.target;
  if (target instanceof HTMLElement && entry.node.contains(target)) {
    entry.lastFocused = target;
  } else {
    focusFirst(entry);
  }
}

export function ModalFocusScope({ id, depth = 0, children }: { id: symbol; depth?: number; children: ReactNode }) {
  return createElement(ModalParent.Provider, { value: { id, depth } }, children);
}

export function useModalFocus<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
): { ref: RefObject<T | null>; scopeId: symbol; layer: number } {
  const ref = useRef<T>(null);
  const [scopeId] = useState(() => Symbol("modal"));
  const parent = useContext(ModalParent);
  const parentId = parent?.id ?? null;
  const layer = (parent?.depth ?? -1) + 1;
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const entry: ModalEntry = {
      id: scopeId,
      parentId,
      node: ref.current,
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      close: () => closeRef.current(),
      lastFocused: null,
      historyToken: null,
      previousToken: null,
      url: window.location.href,
      historyConsumed: false,
    };
    if (!stack.length) {
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("focusin", onFocusIn, true);
      window.addEventListener("popstate", onPopState);
    }
    const firstChild = stack.findIndex((item) => item.parentId === entry.id);
    if (firstChild >= 0) stack.splice(firstChild, 0, entry);
    else stack.push(entry);
    updateInert();
    focusFirst(entry);
    queueHistoryFlush();
    return () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);
      updateInert();
      if (entry.historyToken && currentHistoryToken() === entry.historyToken && !programmaticPopPending &&
          window.location.href === entry.url) {
        programmaticPopPending = true;
        window.history.back();
      }
      if (entry.opener?.isConnected) entry.opener.focus();
      else if (top()) focusFirst(top()!);
      if (!stack.length) {
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("focusin", onFocusIn, true);
        if (!programmaticPopPending) window.removeEventListener("popstate", onPopState);
      }
    };
  }, [isOpen, parentId, scopeId]);

  return { ref, scopeId, layer };
}
