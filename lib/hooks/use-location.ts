"use client";

import { useCallback, useEffect, useState } from "react";

export const CAVITE_DEFAULT_COORDINATES: [number, number] = [120.9367, 14.4172];
export const MANILA_DEFAULT_COORDINATES: [number, number] = [120.9842, 14.5995];

export type PermissionState = "prompt" | "granted" | "denied" | "unsupported";

export function isValidCoordinate(
  coords: [number, number] | null | undefined,
): coords is [number, number] {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) {
    return false;
  }
  const [lng, lat] = coords;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    !Number.isNaN(lng) &&
    !Number.isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

export function useLocation() {
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<PermissionState>(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return "unsupported";
    }
    return "prompt";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    if ("permissions" in navigator && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          setPermissionState(result.state as PermissionState);
          result.onchange = () => {
            setPermissionState(result.state as PermissionState);
          };
        })
        .catch(() => {
          // Permissions API query fallback
        });
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser.");
      setPermissionState("unsupported");
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        setCoordinates(coords);
        setPermissionState("granted");
        setIsLoading(false);
      },
      (geoError) => {
        setIsLoading(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setPermissionState("denied");
          setError("Location permission denied. Please allow location access.");
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setError("Location unavailable. Using default area.");
        } else {
          setError("Could not retrieve your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, []);

  return {
    coordinates,
    error,
    isLoading,
    permissionState,
    requestLocation,
  };
}
