import { describe, it, expect } from 'vitest';
import { calcPrecioBruto } from '../price';

describe('calcPrecioBruto', () => {
  it('should calculate gross price with 19% VAT', () => {
    expect(calcPrecioBruto(1000)).toBe(1190);
    expect(calcPrecioBruto(9200)).toBe(10948);
    expect(calcPrecioBruto(1450)).toBe(1726);
  });

  it('should handle zero price', () => {
    expect(calcPrecioBruto(0)).toBe(0);
  });

  it('should round to nearest integer', () => {
    expect(calcPrecioBruto(999)).toBe(1189);
    expect(calcPrecioBruto(100)).toBe(119);
  });
});
