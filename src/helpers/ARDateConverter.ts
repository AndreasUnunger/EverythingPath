type MonthDef = {
  name: string;
  nameShort: string;
  nameAbbrev: string;
  days: number;
};

type MonthSet = {
  months: MonthDef[];
};

type WeekdayDef = {
  name: string;
  nameShort: string;
  nameAbbrev: string;
};

type WeekdaySet = {
  weekdays: WeekdayDef[];
};

const baseCalendar = {
  monthSet: {
    months: [
      { name: 'Abadius', nameShort: 'Aba', nameAbbrev: 'A', days: 31 },
      { name: 'Calistril', nameShort: 'Cal', nameAbbrev: 'C', days: 28 },
      { name: 'Pharast', nameShort: 'Phar', nameAbbrev: 'P', days: 31 },
      { name: 'Gozran', nameShort: 'Goz', nameAbbrev: 'G', days: 30 },
      { name: 'Desnus', nameShort: 'Des', nameAbbrev: 'D', days: 31 },
      { name: 'Sarenith', nameShort: 'Sar', nameAbbrev: 'S', days: 30 },
      { name: 'Erastus', nameShort: 'Eras', nameAbbrev: 'E', days: 31 },
      { name: 'Arodus', nameShort: 'Aro', nameAbbrev: 'Ar', days: 31 },
      { name: 'Rova', nameShort: 'Rov', nameAbbrev: 'R', days: 30 },
      { name: 'Lamashan', nameShort: 'Lam', nameAbbrev: 'L', days: 31 },
      { name: 'Neth', nameShort: 'Neth', nameAbbrev: 'N', days: 30 },
      { name: 'Kuthona', nameShort: 'Kuth', nameAbbrev: 'K', days: 31 },
    ],
  } as MonthSet,
  weekdaySet: {
    weekdays: [
      { name: 'Sunday', nameShort: 'Sun', nameAbbrev: 'Su' },
      { name: 'Moonday', nameShort: 'Moon', nameAbbrev: 'M' },
      { name: 'Toilday', nameShort: 'Toil', nameAbbrev: 'T' },
      { name: 'Wealday', nameShort: 'Weal', nameAbbrev: 'W' },
      { name: 'Oathday', nameShort: 'Oath', nameAbbrev: 'O' },
      { name: 'Fireday', nameShort: 'Fire', nameAbbrev: 'F' },
      { name: 'Starday', nameShort: 'Star', nameAbbrev: 'St' },
    ],
  } as WeekdaySet,
};

/** Return true for Gregorian leap years. */
function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Convert a JS Date into a formatted string using the provided
 * fantasy month and weekday names, with leap years handled by adding
 * the extra day to Calistril (month index 1).
 *
 * Output format: "Weekday, <day> <MonthName> <year>"
 */
export function formatFantasyDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Invalid Date provided');
  }

  const year = date.getUTCFullYear();

  // Make a copy of month defs so we can mutate days for leap years
  const months: MonthDef[] = baseCalendar.monthSet.months.map((m) => ({
    name: m.name,
    nameShort: m.nameShort,
    nameAbbrev: m.nameAbbrev,
    days: m.days,
  }));

  // If leap year, add one day to Calistril (index 1)
  if (isGregorianLeapYear(year)) {
    if (months.length >= 2) {
      months[1]!.days += 1;
    }
  }

  // Compute day of year (1-based) using UTC to avoid timezone issues
  const startOfYearUtc = Date.UTC(year, 0, 1);
  const utcDate = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayOfYear = Math.floor((utcDate - startOfYearUtc) / msPerDay) + 1;

  // Find month and day within that month
  let remaining = dayOfYear;
  let monthIndex = months.length - 1;
  let dayInMonth = months[monthIndex]!.days;

  for (let i = 0; i < months.length; i++) {
    const mDays = months[i]!.days;
    if (remaining <= mDays) {
      monthIndex = i;
      dayInMonth = remaining;
      break;
    }
    remaining -= mDays;
  }

  const weekdayDef =
    baseCalendar.weekdaySet.weekdays[
      date.getUTCDay() % baseCalendar.weekdaySet.weekdays.length
    ];
  const monthDef = months[monthIndex];

  return `${weekdayDef!.name}, ${dayInMonth} ${monthDef!.name} ${year + 2700}`;
}
