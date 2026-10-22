import { getAccountCafeSaveStatusAction } from "@/lib/actions/personal-collection-actions";

const MAX_ACCOUNT_ID_LENGTH = 128;
const MAX_CAFE_ID_LENGTH = 512;
const INVALID_IDENTIFIER_CHARACTERS = /[\s\p{Cc}]/u;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function identifier(value: string | null, maxLength: number): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maxLength || INVALID_IDENTIFIER_CHARACTERS.test(normalized)) {
    return null;
  }
  return normalized;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const accountId = identifier(params.get("accountId"), MAX_ACCOUNT_ID_LENGTH);
  const cafeId = identifier(params.get("cafeId"), MAX_CAFE_ID_LENGTH);

  if (!accountId || !cafeId) {
    return json({ error: "Invalid accountId or cafeId" }, 400);
  }

  try {
    const result = await getAccountCafeSaveStatusAction(accountId, cafeId);
    if (result.ok) return json(result.data);
    return json({ error: result.error }, result.status);
  } catch {
    return json({ error: "Could not load saved status" }, 503);
  }
}
