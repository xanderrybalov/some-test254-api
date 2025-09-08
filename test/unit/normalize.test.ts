import { describe, it, expect } from 'vitest';
import { normalizeTitle, parseRuntime, parseYear, parseList } from '../../src/domain/normalize.js';

describe('normalizeTitle', () => {
  it('should normalize movie titles correctly', () => {
    expect(normalizeTitle('blade runner')).toBe('Blade Runner');
    expect(normalizeTitle('THE MATRIX')).toBe('The Matrix');
    expect(normalizeTitle('star wars: a new hope')).toBe('Star Wars A New Hope');
    expect(normalizeTitle('the lord of the rings')).toBe('The Lord Of The Rings');
  });

  it('should remove non-English characters and symbols', () => {
    expect(normalizeTitle('Amélie (2001)')).toBe('Amlie');
    expect(normalizeTitle('The Matrix: Reloaded')).toBe('The Matrix Reloaded');
    expect(normalizeTitle('Spider-Man')).toBe('Spider Man');
    expect(normalizeTitle('The Lord of the Rings: The Fellowship of the Ring')).toBe('The Lord Of The Rings The Fellowship Of The Ring');
  });

  it('should handle multiple spaces', () => {
    expect(normalizeTitle('the    matrix   reloaded')).toBe('The Matrix Reloaded');
    expect(normalizeTitle('  blade  runner  ')).toBe('Blade Runner');
  });

  it('should handle empty and edge cases', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle('   ')).toBe('');
    expect(normalizeTitle('a')).toBe('A');
    expect(normalizeTitle('123 456')).toBe('');
  });
});

describe('parseRuntime', () => {
  it('should parse runtime strings correctly', () => {
    expect(parseRuntime('117 min')).toBe(117);
    expect(parseRuntime('142 min')).toBe(142);
    expect(parseRuntime('90 min')).toBe(90);
  });

  it('should handle edge cases', () => {
    expect(parseRuntime('N/A')).toBeNull();
    expect(parseRuntime('')).toBeNull();
    expect(parseRuntime('invalid')).toBeNull();
  });
});

describe('parseYear', () => {
  it('should parse year strings correctly', () => {
    expect(parseYear('1982')).toBe(1982);
    expect(parseYear('2019')).toBe(2019);
    expect(parseYear('2019–2023')).toBe(2019);
  });

  it('should validate year ranges', () => {
    expect(parseYear('1800')).toBeNull(); // Too old
    expect(parseYear('2200')).toBeNull(); // Too far in future
    expect(parseYear('1888')).toBe(1888); // Min valid year
    expect(parseYear('2100')).toBe(2100); // Max valid year
  });

  it('should handle edge cases', () => {
    expect(parseYear('N/A')).toBeNull();
    expect(parseYear('')).toBeNull();
    expect(parseYear('invalid')).toBeNull();
  });
});

describe('parseList', () => {
  it('should parse comma-separated lists correctly', () => {
    expect(parseList('Action, Drama, Sci-Fi')).toEqual(['Action', 'Drama', 'Sci-Fi']);
    expect(parseList('Ridley Scott')).toEqual(['Ridley Scott']);
    expect(parseList('Comedy, Romance')).toEqual(['Comedy', 'Romance']);
  });

  it('should handle edge cases', () => {
    expect(parseList('N/A')).toBeNull();
    expect(parseList('')).toBeNull();
    expect(parseList('  ,  ,  ')).toBeNull();
  });
});
