/**
 * Creates the User's Own Live Location Marker styled like Google Maps GPS dot
 * (compact dark roast center with a subtle crisp white outline and radar pulse).
 */
export function createCurrentUserMarkerElement(): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "relative flex items-center justify-center select-none z-30 pointer-events-none";
  container.style.transform = "translate(0, 0)";

  // Radar pulse wave (expanding soft halo in dark charcoal tone)
  const pulse = document.createElement("div");
  pulse.className = "absolute rounded-full animate-ping pointer-events-none";
  pulse.style.backgroundColor = "rgba(28, 26, 24, 0.25)";
  pulse.style.width = "32px";
  pulse.style.height = "32px";

  // Google Maps style GPS dot: Dark charcoal base with warm cream center dot
  const dot = document.createElement("div");
  dot.className = "relative flex items-center justify-center pointer-events-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]";
  dot.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Dark Charcoal base circle (#1C1A18) with subtle border (#2E2B27) -->
      <circle cx="9" cy="9" r="8" fill="#1C1A18" stroke="#2E2B27" stroke-width="1" />
      <!-- Warm Cream center dot (#F5F3EF) matching the cafe marker scheme -->
      <circle cx="9" cy="9" r="3.75" fill="#F5F3EF" />
    </svg>
  `;

  container.appendChild(pulse);
  container.appendChild(dot);

  return container;
}
