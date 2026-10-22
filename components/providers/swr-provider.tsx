"use client";

import { useState } from "react";
import { SWRConfig, useSWRConfig, type Cache } from "swr";

export class HttpResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HttpResponseError";
  }
}

export async function fetchJson(resource: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(resource, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Preserve the HTTP error when its response has no JSON body.
    }
    throw new HttpResponseError(message, response.status);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const [cache] = useState<Cache>(() => new Map());
  return (
    <SWRConfig
      value={{
        provider: () => cache,
        fetcher: fetchJson,
        revalidateOnFocus: false,
        keepPreviousData: false,
        shouldRetryOnError: false,
      }}
    >
      <AuthErrorHandler>{children}</AuthErrorHandler>
    </SWRConfig>
  );
}

function AuthErrorHandler({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();
  return <SWRConfig value={{
    onError: (error: unknown) => {
      if (error instanceof HttpResponseError && error.status === 401) {
        void mutate(() => true, undefined, { revalidate: false });
      }
    },
  }}>{children}</SWRConfig>;
}
