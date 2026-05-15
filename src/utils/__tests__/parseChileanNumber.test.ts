import { describe, it, expect } from 'vitest';
import { parseChileanNumber, parseFormato } from '../price';

describe('parseChileanNumber', () => {
  it('should parse Chilean decimal format with comma', () => {
    expect(parseChileanNumber('11,34')).toBeCloseTo(11.34);
    expect(parseChileanNumber('1,5')).toBeCloseTo(1.5);
    expect(parseChileanNumber('0,5')).toBeCloseTo(0.5);
  });

  it('should parse whole numbers without comma', () => {
    expect(parseChileanNumber('10')).toBeCloseTo(10);
    expect(parseChileanNumber('2')).toBeCloseTo(2);
    expect(parseChileanNumber('0')).toBeCloseTo(0);
  });

  it('should handle leading zeros', () => {
    expect(parseChileanNumber('0,25')).toBeCloseTo(0.25);
    expect(parseChileanNumber('00,50')).toBeCloseTo(0.5);
  });

  it('should return 0 for invalid input', () => {
    expect(parseChileanNumber('')).toBe(0);
    expect(parseChileanNumber('abc')).toBe(0);
    expect(parseChileanNumber('not a number')).toBe(0);
  });
});

describe('parseFormato', () => {
  it('should be an alias for parseChileanNumber', () => {
    expect(parseFormato('11,34')).toBeCloseTo(11.34);
    expect(parseFormato('1,5')).toBeCloseTo(1.5);
    expect(parseFormato('')).toBe(0);
  });

  it('should produce same output as parseChileanNumber', () => {
    const testValues = ['11,34', '1', '0,5', 'abc', ''];
    testValues.forEach(val => {
      expect(parseFormato(val)).toBe(parseChileanNumber(val));
    });
  });
});