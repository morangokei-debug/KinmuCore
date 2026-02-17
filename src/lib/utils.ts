import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { RoundingUnit } from '@/types';

export function formatDate(date: string | Date, fmt: string = 'yyyy/MM/dd'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: ja });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: ja });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy/MM/dd HH:mm', { locale: ja });
}

export function minutesToHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}時間${m.toString().padStart(2, '0')}分`;
}

export function minutesToDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function roundMinutes(minutes: number, unit: RoundingUnit): number {
  if (unit === 1) return minutes;
  return Math.floor(minutes / unit) * unit;
}

export function calculateWorkingMinutes(
  clockIn: string | Date,
  clockOut: string | Date,
  breakMinutes: number
): number {
  const inDate = typeof clockIn === 'string' ? parseISO(clockIn) : clockIn;
  const outDate = typeof clockOut === 'string' ? parseISO(clockOut) : clockOut;
  const totalMinutes = differenceInMinutes(outDate, inDate);
  return Math.max(0, totalMinutes - breakMinutes);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}
