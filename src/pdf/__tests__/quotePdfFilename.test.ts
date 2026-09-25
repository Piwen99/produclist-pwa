import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getQuotePDFFileName, slugifyCliente } from '../quotePdfFilename';

describe('getQuotePDFFileName', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses cotizacion-YYYY-MM-DD.pdf without a client', () => {
    expect(getQuotePDFFileName()).toBe('cotizacion-2026-03-09.pdf');
  });

  it('appends a slug when a client is provided', () => {
    expect(getQuotePDFFileName('Acme SpA')).toBe('cotizacion-2026-03-09-acme-spa.pdf');
  });

  it('strips accents from the client slug', () => {
    expect(getQuotePDFFileName('José Pérez')).toBe('cotizacion-2026-03-09-jose-perez.pdf');
  });

  it('collapses punctuation runs and trims dashes', () => {
    expect(getQuotePDFFileName('  --Mercado / Sur--  ')).toBe(
      'cotizacion-2026-03-09-mercado-sur.pdf'
    );
  });

  it('falls back to no slug when the client sanitizes to nothing', () => {
    expect(getQuotePDFFileName('   ')).toBe('cotizacion-2026-03-09.pdf');
    expect(getQuotePDFFileName('///')).toBe('cotizacion-2026-03-09.pdf');
    expect(getQuotePDFFileName('')).toBe('cotizacion-2026-03-09.pdf');
  });

  it('never emits slashes or spaces', () => {
    const fileName = getQuotePDFFileName('Café / Bar Ñuñoa');
    expect(fileName).not.toMatch(/[ /]/);
    expect(fileName.endsWith('.pdf')).toBe(true);
  });
});

describe('slugifyCliente', () => {
  it('lowercases and replaces non [a-z0-9] runs with single dashes', () => {
    expect(slugifyCliente('Almacén   Los Andes')).toBe('almacen-los-andes');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugifyCliente('¿¡!?')).toBe('');
  });
});