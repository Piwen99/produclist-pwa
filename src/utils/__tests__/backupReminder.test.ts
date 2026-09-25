import { describe, it, expect, beforeEach } from 'vitest';
import {
  daysSinceLastBackup,
  getLastBackupAt,
  markBackedUp,
  shouldRemindBackup,
  snoozeBackupReminder,
  REMIND_AFTER_DAYS,
} from '../backupReminder';

const now = new Date('2026-09-25T12:00:00.000Z');
const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);

describe('backupReminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reminds when the user never exported', () => {
    expect(getLastBackupAt()).toBeNull();
    expect(daysSinceLastBackup(now)).toBeNull();
    expect(shouldRemindBackup(now)).toBe(true);
  });

  it('does not remind right after a backup', () => {
    markBackedUp(now);
    expect(daysSinceLastBackup(now)).toBe(0);
    expect(shouldRemindBackup(now)).toBe(false);
  });

  it('does not remind before the threshold', () => {
    markBackedUp(daysAgo(REMIND_AFTER_DAYS - 1));
    expect(shouldRemindBackup(now)).toBe(false);
  });

  it('reminds at or after the threshold', () => {
    markBackedUp(daysAgo(REMIND_AFTER_DAYS));
    expect(shouldRemindBackup(now)).toBe(true);
  });

  it('a dismissal silences the reminder for a few days', () => {
    snoozeBackupReminder(now);
    expect(shouldRemindBackup(now)).toBe(false);
    expect(shouldRemindBackup(new Date(now.getTime() + DAY_MS))).toBe(false);
    expect(shouldRemindBackup(new Date(now.getTime() + 4 * DAY_MS))).toBe(true);
  });

  it('ignores a corrupted stored date', () => {
    localStorage.setItem('produclist:lastBackupAt', 'not-a-date');
    expect(getLastBackupAt()).toBeNull();
    expect(shouldRemindBackup(now)).toBe(true);
  });
});
