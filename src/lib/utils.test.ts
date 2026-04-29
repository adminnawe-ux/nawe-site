import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resolves tailwind conflicts, keeping last value', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('drops falsy values', () => {
    expect(cn('base', false && 'skip', undefined, null, 'keep')).toBe('base keep');
  });

  it('handles conditional objects', () => {
    expect(cn({ 'font-bold': true, 'italic': false })).toBe('font-bold');
  });

  it('returns empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
