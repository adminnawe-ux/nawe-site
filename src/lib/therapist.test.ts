import { describe, it, expect } from 'vitest';
import { formatTherapistDisplayName } from './therapist';

describe('formatTherapistDisplayName', () => {
  it('formats first + last with abbreviated last name', () => {
    expect(formatTherapistDisplayName('Alice', 'Wanjiru')).toBe('Alice W.');
  });

  it('returns first name only when no last name', () => {
    expect(formatTherapistDisplayName('Alice', null)).toBe('Alice');
    expect(formatTherapistDisplayName('Alice', '')).toBe('Alice');
  });

  it('returns last name only when no first name', () => {
    expect(formatTherapistDisplayName(null, 'Wanjiru')).toBe('Wanjiru');
    expect(formatTherapistDisplayName('', 'Wanjiru')).toBe('Wanjiru');
  });

  it('returns empty string when both are empty', () => {
    expect(formatTherapistDisplayName(null, null)).toBe('');
    expect(formatTherapistDisplayName(undefined, undefined)).toBe('');
    expect(formatTherapistDisplayName('', '')).toBe('');
  });

  it('trims whitespace before formatting', () => {
    expect(formatTherapistDisplayName('  Alice  ', '  Wanjiru  ')).toBe('Alice W.');
  });
});
