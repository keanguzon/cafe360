import { describe, expect, it } from "vitest";

import {
  CAVITE_DEFAULT_COORDINATES,
  MANILA_DEFAULT_COORDINATES,
  isValidCoordinate,
} from "./use-location";

describe("use-location utilities", () => {
  it("provides valid default test coordinates for Cavite and Manila", () => {
    expect(CAVITE_DEFAULT_COORDINATES).toEqual([120.9367, 14.4172]);
    expect(MANILA_DEFAULT_COORDINATES).toEqual([120.9842, 14.5995]);
  });

  it("correctly validates longitude and latitude ranges", () => {
    expect(isValidCoordinate([120.9367, 14.4172])).toBe(true);
    expect(isValidCoordinate([-180, -90])).toBe(true);
    expect(isValidCoordinate([180, 90])).toBe(true);

    expect(isValidCoordinate([181, 14])).toBe(false);
    expect(isValidCoordinate([120, 95])).toBe(false);
    expect(isValidCoordinate([NaN, 14])).toBe(false);
  });
});
