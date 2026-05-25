// Club is in Bellingham, WA — render all times in Pacific so the site reads
// correctly regardless of where the visitor's browser is. (The DB stores UTC.)
const TZ = "America/Los_Angeles";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: TZ,
});

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TZ,
  timeZoneName: "short",
});

export const fmtDate = (unixSec: number) => DATE_FMT.format(unixSec * 1000);
export const fmtTime = (unixSec: number) => TIME_FMT.format(unixSec * 1000);
export const fmtDateTime = (unixSec: number) =>
  `${fmtDate(unixSec)} · ${fmtTime(unixSec)}`;

export const fmtMoney = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/**
 * Converts a Unix timestamp to the `YYYY-MM-DDTHH:MM` format that
 * <input type="datetime-local"> expects, in Pacific time.
 */
export function toLocalDateTimeInput(unixSec: number): string {
  // `day: "numeric"` would emit single-digit values which <input type="datetime-local">
  // rejects (and silently renders blank). Force 2-digit on every component.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
  const parts = Object.fromEntries(fmt.formatToParts(unixSec * 1000).map((p) => [p.type, p.value]));
  // Some locales emit "24" for midnight — normalize to "00".
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}
