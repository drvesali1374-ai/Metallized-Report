export function getTehranTime(): Date {
  return new Date();
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

// Cached formatters for performance
const persianDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  calendar: 'persian'
});

const persianDateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  calendar: 'persian'
});

const jalaliPartsFormatter = new Intl.DateTimeFormat('en-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  calendar: 'persian'
});

export function formatPersianDateTime(date: Date | string): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return persianDateTimeFormatter.format(d);
}

export function formatPersianDateOnly(date: Date | string): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return persianDateFormatter.format(d);
}

export function formatHeaderDate(date: Date): string {
  const parts = getJalaliParts(date);
  const dayName = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', calendar: 'persian' }).format(date);
  const y = parts.year.toString();
  const m = parts.month.toString().padStart(2, '0');
  const d = parts.day.toString().padStart(2, '0');
  return `${y}/${m}/${d} (${dayName})`;
}

export function getJalaliParts(date: Date) {
  const parts = jalaliPartsFormatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function isLeapJalali(year: number): boolean {
  return ((((((year - 474) % 2820) + 474) + 38) * 682) % 2816) < 682;
}

export function getDaysInJalaliMonth(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isLeapJalali(year) ? 30 : 29;
}

export function jalaliToGregorian(jy: number, jm: number, jd: number, h: number = 0, min: number = 0): Date {
  const jyadj = jy - 979;
  const jmadj = jm - 1;
  const jdadj = jd - 1;
  let days = 365 * jyadj + Math.floor(jyadj / 33) * 8 + Math.floor((jyadj % 33 + 3) / 4);
  for (let i = 0; i < jmadj; ++i) days += (i < 6) ? 31 : 30;
  days += jdadj;
  let gd = days + 79;
  let gy = 1600 + 400 * Math.floor(gd / 146097);
  gd %= 146097;
  let leap = true;
  if (gd >= 36525) {
    gd--;
    gy += 100 * Math.floor(gd / 36524);
    gd %= 36524;
    if (gd >= 365) gd++; else leap = false;
  }
  gy += 4 * Math.floor(gd / 1461);
  gd %= 1461;
  if (gd >= 366) {
    leap = false;
    gd--;
    gy += Math.floor(gd / 365);
    gd %= 365;
  }
  const daysInGMonths = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  for (; gm <= 12; ++gm) {
    if (gd < daysInGMonths[gm]) break;
    gd -= daysInGMonths[gm];
  }
  return new Date(gy, gm - 1, gd + 1, h, min, 0, 0);
}

export function getFirstDayOfMonthWeekday(jYear: number, jMonth: number): number {
  const gDate = jalaliToGregorian(jYear, jMonth, 1, 12, 0);
  return (gDate.getDay() + 1) % 7;
}

export function isFriday(jYear: number, jMonth: number, jDay: number): boolean {
  const gDate = jalaliToGregorian(jYear, jMonth, jDay, 12, 0);
  return gDate.getDay() === 5;
}

export function isToday(date: Date | string): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = getTehranTime();
  const dParts = getJalaliParts(d);
  const nowParts = getJalaliParts(now);
  return dParts.year === nowParts.year && dParts.month === nowParts.month && dParts.day === nowParts.day;
}

export function isPastDeadline(deadline: Date | string): boolean {
  if (!deadline) return false;
  const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
  return d < getTehranTime();
}