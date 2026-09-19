import {
  startOfDay,
  endOfDay,
  subDays,
  startOfYear,
  format,
  isToday,
  isYesterday,
  differenceInMinutes,
  differenceInHours,
} from 'date-fns';
import { DatePreset } from '@/app/inbox/types';

export function calculateDateRangeFromPreset(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): { from?: string; to?: string } {
  const now = new Date();

  switch (preset) {
    case 'today':
      return {
        from: format(startOfDay(now), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return {
        from: format(startOfDay(yesterday), 'yyyy-MM-dd'),
        to: format(endOfDay(yesterday), 'yyyy-MM-dd'),
      };
    }
    case '7d':
      return {
        from: format(startOfDay(subDays(now, 7)), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case '30d':
      return {
        from: format(startOfDay(subDays(now, 30)), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case '90d':
      return {
        from: format(startOfDay(subDays(now, 90)), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case 'year':
      return {
        from: format(startOfYear(now), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case 'custom':
      return {
        from: customFrom,
        to: customTo,
      };
    case 'all':
    default:
      return {};
  }
}

export function formatEmailDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  if (isToday(date)) {
    return `Today, ${format(date, 'h:mm a')}`;
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  const currentYear = new Date().getFullYear();
  if (date.getFullYear() === currentYear) {
    return format(date, 'MMM d');
  }
  return format(date, 'MMM d, yyyy');
}

export function formatExactTimestamp(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  return format(date, 'd MMM yyyy, h:mm a');
}

export function formatTimeAgo(dateInput?: string | Date | null): string {
  if (!dateInput) return 'Never';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Never';

  const diffMins = differenceInMinutes(new Date(), date);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = differenceInHours(new Date(), date);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return formatEmailDate(date);
}
