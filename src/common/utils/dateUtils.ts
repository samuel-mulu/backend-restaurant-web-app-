/**
 * Format date as YYYY-MM-DD in local timezone.
 */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse YYYY-MM-DD string as local date (timezone-safe).
 * Avoids new Date(string) which can interpret as UTC midnight.
 */
export function parseDateLocal(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) {
    return new Date(dateStr);
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Parse YYYY-MM-DD as start of day (00:00:00.000)
 */
export function parseStartOfDay(dateStr: string): Date {
  const d = parseDateLocal(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse YYYY-MM-DD as end of day (23:59:59.999)
 */
export function parseEndOfDay(dateStr: string): Date {
  const d = parseDateLocal(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}
