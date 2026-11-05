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

export const fantasyCalendar = {
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

  const parts = getFantasyDateParts(date);
  const weekdayIndex =
    date.getUTCDay() % fantasyCalendar.weekdaySet.weekdays.length;
  const weekdayDef = fantasyCalendar.weekdaySet.weekdays[weekdayIndex];
  if (!weekdayDef) {
    throw new RangeError('Invalid weekday');
  }

  return `${weekdayDef.name}, ${parts.day} ${parts.month.name} ${parts.year}`;
}

export function getFantasyMonthsForGregorianYear(year: number): MonthDef[] {
  const months: MonthDef[] = fantasyCalendar.monthSet.months.map((month) => ({
    name: month.name,
    nameShort: month.nameShort,
    nameAbbrev: month.nameAbbrev,
    days: month.days,
  }));

  const february = months[1];
  if (isGregorianLeapYear(year) && february) {
    february.days += 1;
  }

  return months;
}

export function getFantasyDateParts(date: Date) {
  const year = date.getUTCFullYear();
  const months = getFantasyMonthsForGregorianYear(year);
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

  let remaining = dayOfYear;
  let monthIndex = months.length - 1;
  let dayInMonth = months[monthIndex]?.days ?? 0;

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    if (!month) {
      continue;
    }

    const monthDays = month.days;
    if (remaining <= monthDays) {
      monthIndex = i;
      dayInMonth = remaining;
      break;
    }
    remaining -= monthDays;
  }

  const month = months[monthIndex];
  if (!month) {
    throw new RangeError('Invalid fantasy date');
  }

  return {
    year: year + 2700,
    monthIndex,
    month,
    day: dayInMonth,
  };
}

export function createDateFromFantasyParts({
  year,
  monthIndex,
  day,
}: {
  year: number;
  monthIndex: number;
  day: number;
}) {
  const gregorianYear = year - 2700;
  const months = getFantasyMonthsForGregorianYear(gregorianYear);
  const month = months[monthIndex];
  if (!month || day < 1 || day > month.days) {
    throw new RangeError('Invalid fantasy date');
  }

  const dayOfYear =
    months.slice(0, monthIndex).reduce((sum, current) => sum + current.days, 0) + day;
  return new Date(Date.UTC(gregorianYear, 0, dayOfYear));
}

export const fantasyWeekdayHeadersMondayFirst = [
  fantasyCalendar.weekdaySet.weekdays[1]!,
  fantasyCalendar.weekdaySet.weekdays[2]!,
  fantasyCalendar.weekdaySet.weekdays[3]!,
  fantasyCalendar.weekdaySet.weekdays[4]!,
  fantasyCalendar.weekdaySet.weekdays[5]!,
  fantasyCalendar.weekdaySet.weekdays[6]!,
  fantasyCalendar.weekdaySet.weekdays[0]!,
];
