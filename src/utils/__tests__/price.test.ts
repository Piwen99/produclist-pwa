import { describe, it, expect } from 'vitest';
import { calcPrecioBruto, calcTotal } from '../price';

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

describe('calcTotal', () => {
  it('should calculate total from formato and precioBruto', () => {
    // formato "11,34" → 11.34, multiplied by 1190 (1000 * 1.19) → 13494.6 → rounded to 13495
    expect(calcTotal('11,34', 1190)).toBe(13495);
    expect(calcTotal('1,5', 1000)).toBe(1500);
    expect(calcTotal('0,25', 2000)).toBe(500);
  });

  it('should handle whole number formato (no comma)', () => {
    expect(calcTotal('10', 1000)).toBe(10000);
    expect(calcTotal('2', 5000)).toBe(10000);
  });

  it('should handle zero values', () => {
    expect(calcTotal('0', 1000)).toBe(0);
    expect(calcTotal('', 1000)).toBe(0);
    expect(calcTotal('5,5', 0)).toBe(0);
  });

  it('should round to nearest integer', () => {
    // 1.234 * 1000 = 1234
    expect(calcTotal('1,234', 1000)).toBe(1234);
    // 1.999 * 1000 = 1999
    expect(calcTotal('1,999', 1000)).toBe(1999);
  });

  it('should handle invalid formato gracefully', () => {
    expect(calcTotal('abc', 1000)).toBe(0);
    expect(calcTotal('', 1000)).toBe(0);
  });
});
