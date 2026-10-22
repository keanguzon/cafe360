"use client";
import { useState } from "react";
import useSWR from "swr";
import { HttpResponseError } from "@/components/providers/swr-provider";
import type { SheetReadResult } from "@/lib/actions/sheet-read-actions";
export function unwrapSheetRead<T>(result: SheetReadResult<T>): T {
    if (!result.ok)
        throw new HttpResponseError(result.error, result.status);
    return result.data;
}
export function useSheetResource<T>(key: readonly string[] | null, read: () => Promise<T>, active: boolean) {
    const scope = JSON.stringify(key);
    const [denials, setDenials] = useState<ReadonlyMap<string, Error>>(new Map());
    const { data, error, isLoading, mutate } = useSWR<T, Error>(key, async () => {
        try {
            const value = await read();
            setDenials(previous => { if (!previous.has(scope))
                return previous; const next = new Map(previous); next.delete(scope); return next; });
            return value;
        }
        catch (cause) {
            if (cause instanceof HttpResponseError && (cause.status === 401 || cause.status === 403))
                setDenials(previous => new Map(previous).set(scope, cause));
            throw cause;
        }
    }, {
        keepPreviousData: false,
        revalidateIfStale: false,
        revalidateOnFocus: active,
        revalidateOnReconnect: active,
        refreshInterval: active ? 60000 : 0,
        isPaused: () => !active,
        shouldRetryOnError: false,
    });
    const denied = denials.get(scope) ?? (error instanceof HttpResponseError && (error.status === 401 || error.status === 403) ? error : undefined);
    const visible = denied ? undefined : data;
    return {
        data: visible,
        initialLoading: !!key && isLoading && !visible,
        error: denied ?? error ?? null,
        refresh: async () => { await mutate(); },
    };
}
