export type CafeHoursEntry = {
  id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  timezone?: string;
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getDayName(day: number): string {
  return DAY_NAMES[day] || "Unknown";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutes(value: string | null): number | null {
  if (value === null) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isCurrentlyOpen(
  hours: CafeHoursEntry[],
  timezone: string,
  now: Date = new Date(),
): "open" | "closed" | "unknown" {
  if (!hours.length || Number.isNaN(now.getTime())) return "unknown";
  let day: number;
  let currentMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    day = WEEKDAYS.indexOf(part("weekday") ?? "");
    currentMinutes = Number(part("hour")) * 60 + Number(part("minute"));
    if (day < 0 || !Number.isFinite(currentMinutes)) return "unknown";
  } catch {
    return "unknown";
  }

  const today = hours.find((item) => item.day_of_week === day);
  const yesterday = hours.find((item) => item.day_of_week === (day + 6) % 7);
  if (yesterday && !yesterday.is_closed) {
    const previousOpen = minutes(yesterday.open_time);
    const previousClose = minutes(yesterday.close_time);
    if (previousOpen === null || previousClose === null) return "unknown";
    if (previousOpen > previousClose && currentMinutes < previousClose) return "open";
  }
  if (!today) return "unknown";
  if (today.is_closed) return "closed";
  const open = minutes(today.open_time);
  const close = minutes(today.close_time);
  if (open === null || close === null || open === close) return "unknown";
  if (open < close) return currentMinutes >= open && currentMinutes < close ? "open" : "closed";
  return currentMinutes >= open ? "open" : "closed";
}
