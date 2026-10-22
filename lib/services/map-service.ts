import { CAVITE_DEFAULT_COORDINATES } from "../hooks/use-location";

export const DEFAULT_MAP_CENTER: [number, number] = CAVITE_DEFAULT_COORDINATES;
export const DEFAULT_ZOOM: number = 13.5;

export const MAPBOX_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
  streets: "mapbox://styles/mapbox/streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
} as const;

export type MapStyleKey = keyof typeof MAPBOX_STYLES;

type PublicMapboxEnv = {
  NEXT_PUBLIC_MAPBOX_TOKEN?: string;
};

export function hasMapboxConfig(
  env: PublicMapboxEnv = {
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  },
): boolean {
  return Boolean(env.NEXT_PUBLIC_MAPBOX_TOKEN && env.NEXT_PUBLIC_MAPBOX_TOKEN.trim().length > 0);
}

export function getMapboxToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error(
      "Missing NEXT_PUBLIC_MAPBOX_TOKEN. Please set your Mapbox token in .env.local.",
    );
  }
  return token;
}

export function createFlyToOptions(
  center: [number, number],
  zoom: number = 15,
): {
  center: [number, number];
  duration: number;
  essential: boolean;
  zoom: number;
} {
  return {
    center,
    zoom,
    essential: true,
    duration: 2000,
  };
}
