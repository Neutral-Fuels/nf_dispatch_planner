import { format, parseISO } from 'date-fns'

/**
 * Format a date string to display format
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  try {
    return format(parseISO(dateString), 'dd MMM yyyy')
  } catch {
    return dateString
  }
}

/**
 * Format a date string for API requests (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Format a time string (HH:MM)
 */
export function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return '-'
  // If it's already in HH:MM format, return as is
  if (/^\d{2}:\d{2}$/.test(timeString)) return timeString
  // Try parsing as ISO
  try {
    return format(parseISO(timeString), 'HH:mm')
  } catch {
    return timeString
  }
}

/**
 * Format volume in liters with K suffix for thousands
 */
export function formatVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) return '-'
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K L`
  }
  return `${volume} L`
}

/**
 * Format volume as short (e.g., 1.5K)
 */
export function formatVolumeShort(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) return '-'
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`
  }
  return `${volume}`
}

/**
 * Format a timestamp to display format with time
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  try {
    return format(parseISO(dateString), 'dd MMM yyyy HH:mm')
  } catch {
    return dateString
  }
}

/**
 * Format phone number
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-'
  // Basic formatting - can be enhanced for UAE numbers
  return phone
}

/**
 * Combine class names with conditional support
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
