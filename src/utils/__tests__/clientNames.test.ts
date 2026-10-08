import { describe, it, expect } from 'vitest';
import { mergeClientNames } from '../clientNames';
import type { SavedQuote } from '../../types/quote';
import type { ListSend } from '../../types/listSend';

const quote = (cliente?: string): SavedQuote => ({
  fecha: new Date('2026-10-01'),
  cliente,
  items: [],
  totalNeto: 0,
  iva: 0,
  total: 0,
});

const send = (cliente: string): ListSend => ({
  fecha: new Date('2026-10-02'),
  cliente,
  items: [],
});

describe('mergeClientNames', () => {
  it('returns quotes before sends and keeps the first-seen casing', () => {
    expect(mergeClientNames([quote('juan')], [send('JUAN')])).toEqual(['juan']);
  });

  it('skips missing and whitespace-only names', () => {
    expect(mergeClientNames([quote(undefined), quote('   ')], [send('  ')])).toEqual([]);
  });

  it('dedupes case-insensitively', () => {
    expect(mergeClientNames([quote('Ana'), quote('ANA')], [send('ana')])).toEqual(['Ana']);
  });

  it('trims surrounding whitespace', () => {
    expect(mergeClientNames([quote('  Ana  ')], [send('  juan ')])).toEqual(['Ana', 'juan']);
  });

  it('sorts with the Spanish locale', () => {
    expect(mergeClientNames([quote('Zorro'), quote('Ávila')], [send('beto')])).toEqual([
      'Ávila',
      'beto',
      'Zorro',
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(mergeClientNames([], [])).toEqual([]);
  });
});
