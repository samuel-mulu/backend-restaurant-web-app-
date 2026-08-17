/**
 * Ethiopian calendar conversion — same authority as the frontend.
 *
 * Julian Day epoch 1723856 (Unicode/ICU). Civil dates are interpreted in
 * Africa/Addis_Ababa. Do not apply a ±1 day offset.
 */

export interface EthiopianDate {
  year: number;
  month: number; // 1-13 (13 is Pagume)
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

const ADDIS_TIMEZONE = "Africa/Addis_Ababa";
const ETHIOPIC_EPOCH = 1723856;

const ETHIOPIAN_MONTH_NAMES = [
  "",
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miazia",
  "Genbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addisNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
}

function civilPartsFromInstant(date: Date): GregorianDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADDIS_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : NaN;
  };

  return { year: get("year"), month: get("month"), day: get("day") };
}

function civilParts(input: Date | string): GregorianDate {
  if (typeof input === "string") {
    const dateOnly = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return {
        year: Number(dateOnly[1]),
        month: Number(dateOnly[2]),
        day: Number(dateOnly[3]),
      };
    }
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${input}`);
    }
    return civilPartsFromInstant(parsed);
  }
  if (isNaN(input.getTime())) {
    throw new Error("Invalid Date");
  }
  return civilPartsFromInstant(input);
}

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

function jdnToEthiopic(jdn: number): EthiopianDate {
  const r = ((jdn - ETHIOPIC_EPOCH) % 1461 + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year:
      4 * Math.floor((jdn - ETHIOPIC_EPOCH) / 1461) +
      Math.floor(r / 365) -
      Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

function ethiopicToJdn(year: number, month: number, day: number): number {
  return (
    ETHIOPIC_EPOCH + 365 * year + Math.floor(year / 4) + 30 * (month - 1) + day - 1
  );
}

export function gregorianToEthiopian(date: Date): EthiopianDate {
  const { year, month, day } = civilParts(date);
  return jdnToEthiopic(gregorianToJdn(year, month, day));
}

export function ethiopianToGregorian(ethiopianDate: EthiopianDate): Date {
  const { year, month, day } = ethiopianDate;
  const g = jdnToGregorian(ethiopicToJdn(year, month, day));
  return addisNoon(g.year, g.month, g.day);
}

function isEthiopianLeapYear(year: number): boolean {
  return year % 4 === 3;
}

function getEthiopianMonthDays(month: number, year: number): number {
  if (month >= 1 && month <= 12) return 30;
  if (month === 13) return isEthiopianLeapYear(year) ? 6 : 5;
  return 0;
}

export function formatEthiopianDate(date: EthiopianDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

export function parseEthiopianDate(dateString: string): EthiopianDate {
  if (typeof dateString !== "string") {
    throw new Error(
      `Invalid Ethiopian date: expected string, got ${typeof dateString}`
    );
  }

  const parts = dateString.split("-");
  if (parts.length !== 3) {
    throw new Error("Invalid Ethiopian date format. Expected YYYY-MM-DD");
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error("Invalid Ethiopian date values");
  }

  if (month < 1 || month > 13) {
    throw new Error("Ethiopian month must be between 1 and 13");
  }

  const maxDays = getEthiopianMonthDays(month, year);
  if (day < 1 || day > maxDays) {
    throw new Error(`Day must be between 1 and ${maxDays} for month ${month}`);
  }

  return { year, month, day };
}

export function getCurrentEthiopianDate(): EthiopianDate {
  return gregorianToEthiopian(new Date());
}

export function addEthiopianMonths(
  date: EthiopianDate,
  months: number
): EthiopianDate {
  let newYear = date.year;
  let newMonth = date.month + months;
  let newDay = date.day;

  while (newMonth > 13) {
    newMonth -= 13;
    newYear++;
  }
  while (newMonth < 1) {
    newMonth += 13;
    newYear--;
  }

  const maxDays = getEthiopianMonthDays(newMonth, newYear);
  if (newDay > maxDays) {
    newDay = maxDays;
  }

  return { year: newYear, month: newMonth, day: newDay };
}

export function daysBetweenEthiopianDates(
  startDate: EthiopianDate,
  endDate: EthiopianDate
): number {
  return (
    ethiopicToJdn(endDate.year, endDate.month, endDate.day) -
    ethiopicToJdn(startDate.year, startDate.month, startDate.day)
  );
}

export function getEthiopianMonthName(month: number): string {
  return ETHIOPIAN_MONTH_NAMES[month] || "";
}

export function formatEthiopianDateReadable(date: EthiopianDate): string {
  const monthName = getEthiopianMonthName(date.month);
  return `${date.day} ${monthName} ${date.year}`;
}
