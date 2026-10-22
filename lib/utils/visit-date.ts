export function formatLocalDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid visit date");
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid visit date");
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  if (formatLocalDate(result) !== value) throw new Error("Invalid visit date");
  return result;
}

export function formatManilaDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid visit date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
