import { describe, it, expect } from 'vitest';

// Utilities extracted from Events.tsx for unit testing

function isPast(date: Date) {
  return date < new Date();
}

function filterEvents(events: { starts_at: string; status: string }[], filter: 'upcoming' | 'past' | 'all') {
  if (filter === 'all') return events;
  return events.filter((e) => {
    const past = isPast(new Date(e.starts_at)) || e.status === 'cancelled' || e.status === 'completed';
    return filter === 'past' ? past : !past;
  });
}

function formatPrice(is_free: boolean, price: number | null, currency: string) {
  if (is_free || price == null) return 'Free';
  return `${currency} ${price.toLocaleString()}`;
}

function ticketCodeValid(code: string) {
  return /^[A-Z0-9]{8}$/.test(code);
}

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const events = [
  { starts_at: FUTURE, status: 'published', title: 'Upcoming Event' },
  { starts_at: PAST, status: 'published', title: 'Past Event' },
  { starts_at: FUTURE, status: 'cancelled', title: 'Cancelled Event' },
  { starts_at: FUTURE, status: 'completed', title: 'Completed Event' },
];

describe('Events filtering', () => {
  it('returns all events for "all" filter', () => {
    expect(filterEvents(events, 'all')).toHaveLength(4);
  });

  it('returns only upcoming events', () => {
    const result = filterEvents(events, 'upcoming');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Upcoming Event');
  });

  it('returns past + cancelled + completed for "past" filter', () => {
    const result = filterEvents(events, 'past');
    expect(result).toHaveLength(3);
  });
});

describe('Event price formatting', () => {
  it('shows Free for free events', () => {
    expect(formatPrice(true, null, 'KES')).toBe('Free');
  });

  it('shows Free when is_free regardless of price value', () => {
    expect(formatPrice(true, 500, 'KES')).toBe('Free');
  });

  it('formats paid event price', () => {
    expect(formatPrice(false, 1500, 'KES')).toBe('KES 1,500');
  });

  it('shows Free when price is null on paid event', () => {
    expect(formatPrice(false, null, 'KES')).toBe('Free');
  });
});

describe('Ticket code validation', () => {
  it('accepts 8-character uppercase alphanumeric codes', () => {
    expect(ticketCodeValid('AB12CD34')).toBe(true);
    expect(ticketCodeValid('AAAAAAAA')).toBe(true);
    expect(ticketCodeValid('12345678')).toBe(true);
  });

  it('rejects codes with wrong length', () => {
    expect(ticketCodeValid('AB12CD3')).toBe(false);
    expect(ticketCodeValid('AB12CD345')).toBe(false);
  });

  it('rejects lowercase codes', () => {
    expect(ticketCodeValid('ab12cd34')).toBe(false);
  });

  it('rejects codes with special characters', () => {
    expect(ticketCodeValid('AB12CD3!')).toBe(false);
  });
});
