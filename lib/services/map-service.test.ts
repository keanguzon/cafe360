import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM,
  MAPBOX_STYLES,
  createFlyToOptions,
  hasMapboxConfig,
} from "./map-service";

describe("map-service", () => {
  it("provides standard default center, zoom, and theme styles", () => {
    expect(DEFAULT_MAP_CENTER).toEqual([120.9367, 14.4172]);
    expect(DEFAULT_ZOOM).toBe(13.5);
    expect(MAPBOX_STYLES.dark).toContain("mapbox://styles/mapbox/dark-v11");
    expect(MAPBOX_STYLES.streets).toContain("mapbox://styles/mapbox/streets-v12");
  });

  it("creates valid flyTo configuration objects", () => {
    const flyOptions = createFlyToOptions([120.9842, 14.5995], 15);
    expect(flyOptions.center).toEqual([120.9842, 14.5995]);
    expect(flyOptions.zoom).toBe(15);
    expect(flyOptions.essential).toBe(true);
    expect(flyOptions.duration).toBe(2000);
  });

  it("checks for Mapbox configuration accurately", () => {
    expect(hasMapboxConfig({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.test" })).toBe(true);
    expect(hasMapboxConfig({ NEXT_PUBLIC_MAPBOX_TOKEN: "" })).toBe(false);
    expect(hasMapboxConfig({})).toBe(false);
  });
});
