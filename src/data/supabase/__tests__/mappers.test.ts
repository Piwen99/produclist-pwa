import { describe, it, expect } from 'vitest';
import { OwnershipError } from '../../ports';
import {
  assertRowAffected,
  duplicateProductMessage,
  isUniqueViolation,
  listSendInputToInsert,
  mapPostgrestError,
  productChangesToRow,
  productInputToInsert,
  quoteInputToInsert,
  rowToListSend,
  rowToProduct,
  rowToSavedQuote,
} from '../mappers';
import type { ListSendRow, ProductRow, QuoteRow } from '../rows';
import type { ProductInput } from '../../../types/product';
import type { QuoteInput, ListSendInput } from '../../ports';
import type { QuoteItem } from '../../../types/quote';
import type { ListSendItem } from '../../../types/listSend';

const ROW: ProductRow = {
  id: 7,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precio_neto: 1200,
  disponible: true,
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const INPUT: ProductInput = {
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1200,
  disponible: true,
};

describe('rowToProduct', () => {
  it('maps snake_case columns and carries the owner id', () => {
    expect(rowToProduct(ROW)).toEqual({
      id: 7,
      nombre: 'Almendras',
      categoria: 'Frutos Secos',
      formato: '1',
      precioNeto: 1200,
      disponible: true,
      ownerId: 'user-1',
    });
  });
});

describe('productInputToInsert', () => {
  it('maps precioNeto to precio_neto and omits owner_id when not provided', () => {
    expect(productInputToInsert(INPUT)).toEqual({
      nombre: 'Almendras',
      categoria: 'Frutos Secos',
      formato: '1',
      precio_neto: 1200,
      disponible: true,
    });
  });

  it('includes owner_id when provided', () => {
    expect(productInputToInsert(INPUT, 'user-1')).toEqual({
      nombre: 'Almendras',
      categoria: 'Frutos Secos',
      formato: '1',
      precio_neto: 1200,
      disponible: true,
      owner_id: 'user-1',
    });
  });
});

describe('productChangesToRow', () => {
  it('maps only the provided fields', () => {
    expect(productChangesToRow({ precioNeto: 1500, disponible: false })).toEqual({
      precio_neto: 1500,
      disponible: false,
    });
  });

  it('returns an empty patch when nothing is provided', () => {
    expect(productChangesToRow({})).toEqual({});
  });
});

describe('unique violation helpers', () => {
  it('detects 23505 and ignores other errors', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key value' })).toBe(true);
    expect(isUniqueViolation({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('renders the exact Spanish duplicate message without a trailing period', () => {
    expect(duplicateProductMessage('Almendras')).toBe(
      'Ya existe un producto llamado "Almendras"',
    );
  });

  it('maps 23505 to the duplicate message when the name is known', () => {
    const mapped = mapPostgrestError({ code: '23505', message: 'duplicate key value' }, 'Almendras');
    expect(mapped.message).toBe('Ya existe un producto llamado "Almendras"');
  });

  it('passes other errors through by message', () => {
    expect(mapPostgrestError({ code: '42501', message: 'permission denied' }).message).toBe(
      'permission denied',
    );
  });
});

describe('assertRowAffected', () => {
  it('throws OwnershipError when no row was affected', () => {
    expect(() => {
      assertRowAffected([]);
    }).toThrow(OwnershipError);
  });

  it('also throws on a null result', () => {
    expect(() => {
      assertRowAffected(null);
    }).toThrow(OwnershipError);
  });

  it('accepts a non-empty affected result', () => {
    expect(() => {
      assertRowAffected([{ id: 1 }]);
    }).not.toThrow();
  });

  it('defaults to the Spanish ownership message', () => {
    expect(new OwnershipError().message).toBe('No se puede modificar un registro de otro usuario.');
  });
});

const QUOTE_ITEM: QuoteItem = {
  id: 'q1',
  productId: 1,
  nombre: 'Almendras',
  formato: '1',
  cantidad: 2,
  precioKg: 1000,
};

const QUOTE_ROW: QuoteRow = {
  id: 7,
  fecha: '2026-10-08T00:00:00.000Z',
  cliente: null,
  items: [QUOTE_ITEM],
  total_neto: 2000,
  iva: 380,
  total: 2380,
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const QUOTE_INPUT: QuoteInput = {
  fecha: new Date('2026-10-08T00:00:00.000Z'),
  cliente: 'Juan',
  items: [QUOTE_ITEM],
  totalNeto: 2000,
  iva: 380,
  total: 2380,
};

describe('rowToSavedQuote', () => {
  it('maps snake_case columns, parses the date and carries the owner id', () => {
    expect(rowToSavedQuote({ ...QUOTE_ROW, cliente: 'Juan' })).toEqual({
      id: 7,
      fecha: new Date('2026-10-08T00:00:00.000Z'),
      cliente: 'Juan',
      items: [QUOTE_ITEM],
      totalNeto: 2000,
      iva: 380,
      total: 2380,
      ownerId: 'user-1',
    });
  });

  it('turns a null cliente into undefined', () => {
    expect(rowToSavedQuote(QUOTE_ROW).cliente).toBeUndefined();
  });
});

describe('quoteInputToInsert', () => {
  it('maps to snake_case with an ISO date and omits owner_id when not provided', () => {
    expect(quoteInputToInsert(QUOTE_INPUT)).toEqual({
      fecha: '2026-10-08T00:00:00.000Z',
      cliente: 'Juan',
      items: [QUOTE_ITEM],
      total_neto: 2000,
      iva: 380,
      total: 2380,
    });
  });

  it('includes owner_id when provided', () => {
    expect(quoteInputToInsert(QUOTE_INPUT, 'user-1')).toMatchObject({ owner_id: 'user-1' });
  });
});

const SEND_ITEM: ListSendItem = {
  nombre: 'Almendras',
  formato: '11,34',
  precioNeto: 9200,
  precioBruto: 10948,
};

const SEND_ROW: ListSendRow = {
  id: 5,
  fecha: '2026-10-08T00:00:00.000Z',
  cliente: 'Ana',
  items: [SEND_ITEM],
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const SEND_INPUT: ListSendInput = {
  fecha: new Date('2026-10-08T00:00:00.000Z'),
  cliente: 'Ana',
  items: [SEND_ITEM],
};

describe('rowToListSend', () => {
  it('maps snake_case columns, parses the date and carries the owner id', () => {
    expect(rowToListSend(SEND_ROW)).toEqual({
      id: 5,
      fecha: new Date('2026-10-08T00:00:00.000Z'),
      cliente: 'Ana',
      items: [SEND_ITEM],
      ownerId: 'user-1',
    });
  });
});

describe('listSendInputToInsert', () => {
  it('maps to snake_case with an ISO date and omits owner_id when not provided', () => {
    expect(listSendInputToInsert(SEND_INPUT)).toEqual({
      fecha: '2026-10-08T00:00:00.000Z',
      cliente: 'Ana',
      items: [SEND_ITEM],
    });
  });

  it('includes owner_id when provided', () => {
    expect(listSendInputToInsert(SEND_INPUT, 'user-1')).toMatchObject({ owner_id: 'user-1' });
  });
});
