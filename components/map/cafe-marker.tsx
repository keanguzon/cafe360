import type { CafeSearchResult } from "@/lib/types/places";

export function createCafeMarkerElement(
  cafe: CafeSearchResult,
  isVisited: boolean = false,
  onClick: () => void
): HTMLElement {
  const container = document.createElement("div");
  container.className = "group relative cursor-pointer select-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  container.setAttribute("role", "button");
  container.tabIndex = 0;
  container.setAttribute("aria-label", `Café: ${cafe.name}`);

  const pin = document.createElement("div");
  pin.className = `flex size-11 items-center justify-center rounded-full border-2 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:scale-115 active:scale-95 ${
    isVisited
      ? "border-amber-400 bg-amber-500 text-white shadow-amber-500/40 ring-2 ring-amber-400/30"
      : "border-border/80 bg-surface/95 text-accent hover:border-accent hover:bg-surface"
  }`;

  pin.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
      <path d="M10 2v2"></path>
      <path d="M14 2v2"></path>
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12a4 4 0 1 1 0 8h-1"></path>
      <path d="M6 2v2"></path>
    </svg>
  `;

  const label = document.createElement("div");
  label.className =
    "pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/80 bg-surface/95 px-2 py-0.5 text-[10px] font-bold text-foreground opacity-0 shadow-md backdrop-blur-xs transition-opacity duration-150 group-hover:opacity-100";
  label.innerText = isVisited ? `★ ${cafe.name}` : cafe.name;

  container.appendChild(pin);
  container.appendChild(label);

  container.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return container;
}
