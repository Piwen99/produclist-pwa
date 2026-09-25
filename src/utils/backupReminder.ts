/**
 * Backup reminder state, persisted in localStorage.
 *
 * The price list lives only in this browser's IndexedDB, so the JSON export is
 * the only backup that survives clearing the browser, reinstalling, or changing
 * phone. This module tracks when the user last exported and whether we should
 * nudge them.
 */

const LAST_BACKUP_KEY = 'produclist:lastBackupAt';
const SNOOZE_KEY = 'produclist:backupSnoozeUntil';
const DAY_MS = 86_400_000;

/** Days without a backup before we start reminding. */
export const REMIND_AFTER_DAYS = 14;
/** How long a dismissal silences the reminder. */
export const SNOOZE_DAYS = 3;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the reminder simply never appears.
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** Record that the user just exported a backup. */
export function markBackedUp(now: Date = new Date()): void {
  write(LAST_BACKUP_KEY, now.toISOString());
}

export function getLastBackupAt(): Date | null {
  return parseDate(read(LAST_BACKUP_KEY));
}

/** Days since the last export, or null when the user never exported. */
export function daysSinceLastBackup(now: Date = new Date()): number | null {
  const last = getLastBackupAt();
  return last ? daysBetween(last, now) : null;
}

/** Silence the reminder for SNOOZE_DAYS. */
export function snoozeBackupReminder(now: Date = new Date()): void {
  write(SNOOZE_KEY, new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString());
}

/** Whether the reminder should be shown right now. */
export function shouldRemindBackup(now: Date = new Date()): boolean {
  const snoozedUntil = parseDate(read(SNOOZE_KEY));
  if (snoozedUntil && snoozedUntil.getTime() > now.getTime()) return false;

  const last = getLastBackupAt();
  if (!last) return true;
  return daysBetween(last, now) >= REMIND_AFTER_DAYS;
}
