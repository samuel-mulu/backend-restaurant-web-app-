/**
 * Ethiopian Calendar Conversion Utilities
 *
 * Converts between Gregorian and Ethiopian calendars
 * Ethiopian calendar has 13 months: 12 months of 30 days + Pagume (5 or 6 days)
 * Ethiopian year starts on September 11 (Gregorian) or September 12 in leap years
 */

export interface EthiopianDate {
  year: number;
  month: number; // 1-13 (13 is Pagume)
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/**
 * Check if a Gregorian year is a leap year
 */
function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Check if an Ethiopian year is a leap year
 * Ethiopian leap years occur when the corresponding Gregorian year is a leap year
 */
function isEthiopianLeapYear(year: number): boolean {
  // Convert Ethiopian year to approximate Gregorian year
  const gregorianYear = year + 8;
  return isGregorianLeapYear(gregorianYear);
}

/**
 * Get number of days in an Ethiopian month
 */
function getEthiopianMonthDays(month: number, year: number): number {
  if (month >= 1 && month <= 12) {
    return 30;
  } else if (month === 13) {
    // Pagume has 5 or 6 days depending on leap year
    return isEthiopianLeapYear(year) ? 6 : 5;
  }
  return 0;
}

/**
 * Convert Gregorian date to Ethiopian date
 */
export function gregorianToEthiopian(date: Date): EthiopianDate {
  const gregorianYear = date.getFullYear();
  const gregorianMonth = date.getMonth() + 1; // JavaScript months are 0-indexed
  const gregorianDay = date.getDate();

  // Calculate days since September 11, 8 CE (Ethiopian epoch)
  const epoch = new Date(8, 8, 11); // September 11, 8 CE
  const diffTime = date.getTime() - epoch.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Ethiopian calendar is approximately 7-8 years behind Gregorian
  // Ethiopian New Year is September 11
  // For dates on or after September 11: Ethiopian Year = Gregorian Year - 7
  // For dates before September 11: Ethiopian Year = Gregorian Year - 8
  
  let ethiopianYear = gregorianYear - 7;
  
  // If before September 11, subtract one more year
  if (gregorianMonth < 9 || (gregorianMonth === 9 && gregorianDay < 11)) {
    ethiopianYear = gregorianYear - 8;
  }

  // Calculate days into the Ethiopian year
  let daysIntoYear = diffDays;

  // Adjust for the offset
  const newYearDate = new Date(gregorianYear, 8, 11); // September 11
  if (date < newYearDate) {
    const prevNewYear = new Date(gregorianYear - 1, 8, 11);
    daysIntoYear = Math.floor(
      (date.getTime() - prevNewYear.getTime()) / (1000 * 60 * 60 * 24)
    );
  } else {
    daysIntoYear = Math.floor(
      (date.getTime() - newYearDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Handle negative days
  if (daysIntoYear < 0) {
    ethiopianYear--;
    const prevNewYear = new Date(gregorianYear - 1, 8, 11);
    daysIntoYear = Math.floor(
      (date.getTime() - prevNewYear.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Calculate month and day
  let ethiopianMonth = 1;
  let ethiopianDay = daysIntoYear + 1;

  for (let month = 1; month <= 13; month++) {
    const daysInMonth = getEthiopianMonthDays(month, ethiopianYear);
    if (ethiopianDay <= daysInMonth) {
      ethiopianMonth = month;
      break;
    }
    ethiopianDay -= daysInMonth;
  }

  return {
    year: ethiopianYear,
    month: ethiopianMonth,
    day: ethiopianDay,
  };
}

/**
 * Convert Ethiopian date to Gregorian date
 */
export function ethiopianToGregorian(ethiopianDate: EthiopianDate): Date {
  const { year, month, day } = ethiopianDate;

  // Ethiopian calendar is approximately 7-8 years behind Gregorian
  // Use a known reference: Ethiopian year 2016, Meskerem 1 = Gregorian September 11, 2023
  // This avoids issues with JavaScript Date constructor for ancient dates

  // Calculate total days since Ethiopian epoch (Meskerem 1, 1 EE)
  let totalDays = 0;

  // Add days from previous years (Ethiopian year 1 to year-1)
  for (let y = 1; y < year; y++) {
    totalDays += isEthiopianLeapYear(y) ? 366 : 365;
  }

  // Add days from previous months in current year
  for (let m = 1; m < month; m++) {
    totalDays += getEthiopianMonthDays(m, year);
  }

  // Add days in current month (day - 1 because we start from day 1)
  totalDays += day - 1;

  // Use a known modern reference point to avoid Date constructor issues
  // Ethiopian year 2018, Meskerem 1 (month 1, day 1) = Gregorian September 11, 2024
  // Ethiopian calendar is approximately 7-8 years behind Gregorian
  const referenceEthYear = 2018;
  const referenceGregDate = new Date(2024, 8, 11); // September 11, 2024 (month is 0-indexed)
  referenceGregDate.setHours(0, 0, 0, 0);

  // Calculate days from reference point (Meskerem 1, 2016)
  let daysFromReference = 0;

  // If target year is after reference year, add days
  if (year > referenceEthYear) {
    for (let y = referenceEthYear; y < year; y++) {
      daysFromReference += isEthiopianLeapYear(y) ? 366 : 365;
    }
    // Add days from Meskerem 1 to target month/day
    for (let m = 1; m < month; m++) {
      daysFromReference += getEthiopianMonthDays(m, year);
    }
    daysFromReference += day - 1; // day - 1 because we start from day 1
  }
  // If target year is before reference year, subtract days
  else if (year < referenceEthYear) {
    for (let y = year; y < referenceEthYear; y++) {
      daysFromReference -= isEthiopianLeapYear(y) ? 366 : 365;
    }
    // Subtract days from target month/day to end of year, then add days from Meskerem 1
    for (let m = month; m <= 13; m++) {
      daysFromReference -= getEthiopianMonthDays(m, year);
    }
    daysFromReference += day;
    daysFromReference += 1; // Add 1 to get to Meskerem 1
  }
  // Same year
  else {
    for (let m = 1; m < month; m++) {
      daysFromReference += getEthiopianMonthDays(m, year);
    }
    daysFromReference += day - 1;
  }

  // Create result date
  const resultDate = new Date(referenceGregDate);
  resultDate.setDate(referenceGregDate.getDate() + daysFromReference);

  return resultDate;
}

/**
 * Format Ethiopian date as string (YYYY-MM-DD format)
 */
export function formatEthiopianDate(date: EthiopianDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(
    date.day
  ).padStart(2, "0")}`;
}

/**
 * Parse Ethiopian date from string (YYYY-MM-DD format)
 */
export function parseEthiopianDate(dateString: string): EthiopianDate {
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

/**
 * Get current Ethiopian date
 */
export function getCurrentEthiopianDate(): EthiopianDate {
  return gregorianToEthiopian(new Date());
}

/**
 * Add months to an Ethiopian date
 */
export function addEthiopianMonths(
  date: EthiopianDate,
  months: number
): EthiopianDate {
  let newYear = date.year;
  let newMonth = date.month + months;
  let newDay = date.day;

  // Adjust year and month
  while (newMonth > 13) {
    newMonth -= 13;
    newYear++;
  }
  while (newMonth < 1) {
    newMonth += 13;
    newYear--;
  }

  // Adjust day if it exceeds month length
  const maxDays = getEthiopianMonthDays(newMonth, newYear);
  if (newDay > maxDays) {
    newDay = maxDays;
  }

  return { year: newYear, month: newMonth, day: newDay };
}

/**
 * Calculate days between two Ethiopian dates
 */
export function daysBetweenEthiopianDates(
  startDate: EthiopianDate,
  endDate: EthiopianDate
): number {
  const startGregorian = ethiopianToGregorian(startDate);
  const endGregorian = ethiopianToGregorian(endDate);
  const diffTime = endGregorian.getTime() - startGregorian.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get Ethiopian month name
 */
export function getEthiopianMonthName(month: number): string {
  const monthNames = [
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
  return monthNames[month] || "";
}

/**
 * Format Ethiopian date in readable format
 */
export function formatEthiopianDateReadable(date: EthiopianDate): string {
  const monthName = getEthiopianMonthName(date.month);
  return `${date.day} ${monthName} ${date.year}`;
}
