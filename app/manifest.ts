import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cafe360 — Social Café Discovery",
    short_name: "Cafe360",
    description: "Discover cafés and share café memories with your Circle.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFBF9",
    theme_color: "#FCFBF9",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/cafe360.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Explore Map",
        url: "/map",
        description: "Open the interactive café map",
      },
      {
        name: "Discover Cafés",
        url: "/discover",
        description: "Search and filter nearby coffee spots",
      },
      {
        name: "Circles",
        url: "/circles",
        description: "View activity feed and circles",
      },
      {
        name: "Profile & Stats",
        url: "/profile",
        description: "View personal stats and collections",
      },
    ],
  };
}
