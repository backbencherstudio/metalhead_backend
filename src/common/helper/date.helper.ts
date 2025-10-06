import dayjs from 'dayjs';
/**
 * Date helper
 */
export class DateHelper {
  /**
   * Add days
   * @param value
   * @param unit
   * @returns
   */
  static add(value: number, unit: dayjs.ManipulateType) {
    return dayjs(value).add(30, unit);
  }

  // format date
  static format(date: number | string | Date) {
    // Handle DD/MM/YYYY format
    if (typeof date === 'string' && date.includes('/')) {
      const parts = date.split('/');
      if (parts.length === 3) {
        // Check if it's DD/MM/YYYY format (day > 12)
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        if (day > 12 && month <= 12) {
          // DD/MM/YYYY format
          const d = new Date(year, month - 1, day);
          return d.toISOString();
        }
      }
    }
    
    const d = new Date(date);
    return d.toISOString();
  }
  static formatDate(date: number | string | Date) {
    const d = new Date(date);
    return d.toDateString();
  }

  static now() {
    const date = new Date();
    return date;
  }

  static nowString() {
    const date = new Date();
    return date.toISOString();
  }

  static nowDate() {
    const date = new Date();
    return date.toDateString();
  }

  static addDays(dateData, days: number) {
    days = Number(days);
    const date = new Date(dateData.valueOf());
    date.setDate(date.getDate() + days);
    return date.toDateString();
  }

  static addMonths(dateData, months: number) {
    months = Number(months);
    const date = new Date(dateData.valueOf());
    date.setMonth(date.getMonth() + months);
    return date.toDateString();
  }

  static addYears(dateData, years: number) {
    years = Number(years);
    const date = new Date(dateData.valueOf());
    date.setFullYear(date.getFullYear() + years);
    return date.toDateString();
  }

  static addHours(dateData, hours: number) {
    hours = Number(hours);
    const date = new Date(dateData.valueOf());
    date.setHours(date.getHours() + hours);
    return date.toDateString();
  }

  static addMinutes(dateData, minutes: number) {
    minutes = Number(minutes);
    const date = new Date(dateData.valueOf());
    date.setMinutes(date.getMinutes() + minutes);
    return date.toDateString();
  }

  static addSeconds(dateData, seconds: number) {
    seconds = Number(seconds);
    const date = new Date(dateData.valueOf());
    date.setSeconds(date.getSeconds() + seconds);
    return date.toDateString();
  }

  static diff(
    date1: string,
    date2: string,
    unit?: dayjs.QUnitType | dayjs.OpUnitType,
    float?: boolean,
  ) {
    const date1Data = dayjs(date1);
    const date2Data = dayjs(date2);

    return date2Data.diff(date1Data, unit, float);
  }
}
