import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  saveListSend,
  getAllListSends,
  deleteListSend,
  getClientNames,
  saveQuote,
} from '../database';
import type { ListSendItem } from '../../types/listSend';

const items: ListSendItem[] = [
  { nombre: 'ALMENDRA', formato: '11,34', precioNeto: 9200, precioBruto: 10948 },
];

describe('list sends', () => {
  beforeEach(async () => {
    await db.listSends.clear();
    await db.quotes.clear();
  });

  it('saves and lists newest first', async () => {
    await saveListSend({ cliente: 'Juan', items, fecha: new Date('2026-09-01') });
    await saveListSend({ cliente: 'Ana', items, fecha: new Date('2026-09-20') });

    const all = await getAllListSends();
    expect(all).toHaveLength(2);
    expect(all[0].cliente).toBe('Ana');
  });

  it('deletes by id', async () => {
    const id = await saveListSend({ cliente: 'Juan', items });
    await deleteListSend(id);
    expect(await db.listSends.count()).toBe(0);
  });

  it('collects client names from list sends and quotes, de-duplicated', async () => {
    await saveListSend({ cliente: 'Juan', items });
    await saveListSend({ cliente: '  juan ', items });
    await saveQuote({ cliente: 'Ana', items: [], totalNeto: 0, iva: 0, total: 0 });

    expect(await getClientNames()).toEqual(['Ana', 'Juan']);
  });

  it('ignores missing or blank client names', async () => {
    await saveListSend({ cliente: '   ', items });
    await saveQuote({ items: [], totalNeto: 0, iva: 0, total: 0 });

    expect(await getClientNames()).toEqual([]);
  });
});
