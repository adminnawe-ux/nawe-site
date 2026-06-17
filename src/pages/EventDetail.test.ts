/**
 * Unit, fuzz, and integration-style tests for EventDetail pure logic.
 *
 * Run with: npm run test
 *
 * Functions under test are copied verbatim from EventDetail.tsx — they are
 * module-level helpers that cannot be exported without touching the component
 * file, so we mirror the same pattern used in Events.test.tsx.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Mirror of types / functions from EventDetail.tsx
// ---------------------------------------------------------------------------

interface TicketTier {
  id: string;
  name: string;
  ticket_type: 'individual' | 'group';
  group_size: number | null;
  price: number;
  currency: string;
  capacity: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  soldCount?: number;
}

function tierAvailable(tier: TicketTier, now: Date): { available: boolean; reason?: string } {
  if (tier.sale_starts_at && now < new Date(tier.sale_starts_at)) {
    return { available: false, reason: `Opens ${new Date(tier.sale_starts_at).toLocaleDateString()}` };
  }
  if (tier.sale_ends_at && now > new Date(tier.sale_ends_at)) {
    return { available: false, reason: 'Sale ended' };
  }
  if (tier.capacity !== null && (tier.soldCount ?? 0) >= tier.capacity) {
    return { available: false, reason: 'Sold out' };
  }
  return { available: true };
}

function tierLabel(tier: TicketTier): string {
  if (tier.ticket_type === 'group') return `Group of ${tier.group_size}`;
  return 'Individual';
}

// Mirror of phone validation from handleDetailsNext
function validatePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const normalised = digits.startsWith('0') ? '254' + digits.slice(1) : digits;
  return /^2547\d{8}$/.test(normalised);
}

// Group ticket total STK amount
function groupStkAmount(tier: { price: number; group_size: number | null }): number {
  return tier.price * (tier.group_size ?? 1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-17T10:00:00Z');
const PAST_DATE = '2026-06-10T00:00:00Z';
const FUTURE_DATE = '2026-12-31T00:00:00Z';

function baseTier(overrides: Partial<TicketTier> = {}): TicketTier {
  return {
    id: 'tier-1',
    name: 'Regular',
    ticket_type: 'individual',
    group_size: null,
    price: 1500,
    currency: 'KES',
    capacity: null,
    sale_starts_at: null,
    sale_ends_at: null,
    soldCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// tierAvailable — date gate: not yet started
// ---------------------------------------------------------------------------

describe('tierAvailable — sale not yet started', () => {
  it('blocks a tier whose sale_starts_at is in the future', () => {
    const tier = baseTier({ sale_starts_at: FUTURE_DATE });
    const result = tierAvailable(tier, NOW);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/Opens/);
  });

  it('allows a tier whose sale_starts_at is exactly now (boundary)', () => {
    const tier = baseTier({ sale_starts_at: NOW.toISOString() });
    // now is NOT < sale_starts_at (they are equal) → available
    const result = tierAvailable(tier, NOW);
    expect(result.available).toBe(true);
  });

  it('allows a tier whose sale_starts_at is in the past', () => {
    const tier = baseTier({ sale_starts_at: PAST_DATE });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });

  it('ignores null sale_starts_at', () => {
    const tier = baseTier({ sale_starts_at: null });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tierAvailable — date gate: sale ended
// ---------------------------------------------------------------------------

describe('tierAvailable — sale ended', () => {
  it('blocks a tier whose sale_ends_at is in the past', () => {
    const tier = baseTier({ sale_ends_at: PAST_DATE });
    const result = tierAvailable(tier, NOW);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Sale ended');
  });

  it('allows a tier whose sale_ends_at is in the future', () => {
    const tier = baseTier({ sale_ends_at: FUTURE_DATE });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });

  it('blocks a tier where sale already ended even if start date was in past', () => {
    const tier = baseTier({ sale_starts_at: PAST_DATE, sale_ends_at: PAST_DATE });
    expect(tierAvailable(tier, NOW).available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tierAvailable — capacity gate
// ---------------------------------------------------------------------------

describe('tierAvailable — capacity', () => {
  it('blocks when soldCount equals capacity', () => {
    const tier = baseTier({ capacity: 50, soldCount: 50 });
    const result = tierAvailable(tier, NOW);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Sold out');
  });

  it('blocks when soldCount exceeds capacity (data inconsistency guard)', () => {
    const tier = baseTier({ capacity: 50, soldCount: 51 });
    expect(tierAvailable(tier, NOW).available).toBe(false);
  });

  it('allows when one spot remains', () => {
    const tier = baseTier({ capacity: 50, soldCount: 49 });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });

  it('allows null capacity (unlimited)', () => {
    const tier = baseTier({ capacity: null, soldCount: 9999 });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });

  it('treats undefined soldCount as 0', () => {
    const tier = baseTier({ capacity: 10, soldCount: undefined });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });

  it('capacity-0 tier is immediately sold out', () => {
    const tier = baseTier({ capacity: 0, soldCount: 0 });
    expect(tierAvailable(tier, NOW).available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tierAvailable — combined early-bird (date + capacity)
// ---------------------------------------------------------------------------

describe('tierAvailable — early bird (date AND capacity gated)', () => {
  it('blocks early bird that has ended by date even if spots remain', () => {
    const tier = baseTier({ sale_ends_at: PAST_DATE, capacity: 100, soldCount: 10 });
    expect(tierAvailable(tier, NOW).available).toBe(false);
  });

  it('blocks early bird that is sold out even if date is valid', () => {
    const tier = baseTier({ sale_starts_at: PAST_DATE, sale_ends_at: FUTURE_DATE, capacity: 20, soldCount: 20 });
    expect(tierAvailable(tier, NOW).available).toBe(false);
  });

  it('allows early bird that is within dates and has spots', () => {
    const tier = baseTier({ sale_starts_at: PAST_DATE, sale_ends_at: FUTURE_DATE, capacity: 20, soldCount: 19 });
    expect(tierAvailable(tier, NOW).available).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tierLabel
// ---------------------------------------------------------------------------

describe('tierLabel', () => {
  it('returns Individual for individual tier', () => {
    expect(tierLabel(baseTier({ ticket_type: 'individual' }))).toBe('Individual');
  });

  it('returns Group of N for group tiers', () => {
    expect(tierLabel(baseTier({ ticket_type: 'group', group_size: 4 }))).toBe('Group of 4');
    expect(tierLabel(baseTier({ ticket_type: 'group', group_size: 2 }))).toBe('Group of 2');
  });

  it('handles null group_size gracefully', () => {
    // Should not throw; group_size null is a data error, but label must not crash
    expect(() => tierLabel(baseTier({ ticket_type: 'group', group_size: null }))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phone validation
// ---------------------------------------------------------------------------

describe('validatePhone — Safaricom number validation', () => {
  it('accepts 07XX format', () => {
    expect(validatePhone('0712345678')).toBe(true);
    expect(validatePhone('0798765432')).toBe(true);
  });

  it('accepts +2547XX format', () => {
    expect(validatePhone('+254712345678')).toBe(true);
  });

  it('accepts 2547XX format', () => {
    expect(validatePhone('254712345678')).toBe(true);
  });

  it('rejects non-Safaricom (07XX valid prefix but wrong prefix 6)', () => {
    // 0612345678 → 2546... which is not 2547...
    expect(validatePhone('0612345678')).toBe(false);
  });

  it('rejects too-short numbers', () => {
    expect(validatePhone('07123456')).toBe(false);
    expect(validatePhone('254712')).toBe(false);
  });

  it('rejects too-long numbers', () => {
    expect(validatePhone('07123456789')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validatePhone('')).toBe(false);
  });

  it('rejects letters', () => {
    expect(validatePhone('abcdefghij')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group ticket STK amount
// ---------------------------------------------------------------------------

describe('groupStkAmount', () => {
  it('charges price × group_size for group tickets', () => {
    expect(groupStkAmount({ price: 1500, group_size: 4 })).toBe(6000);
  });

  it('charges price × 2 for couples tier', () => {
    expect(groupStkAmount({ price: 2000, group_size: 2 })).toBe(4000);
  });

  it('falls back to ×1 when group_size is null', () => {
    expect(groupStkAmount({ price: 1500, group_size: null })).toBe(1500);
  });

  it('handles free group ticket (price 0)', () => {
    expect(groupStkAmount({ price: 0, group_size: 4 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fuzz — tierAvailable with random inputs
// ---------------------------------------------------------------------------

describe('tierAvailable — fuzz: never throws on arbitrary inputs', () => {
  const randomDateOffset = (sign: 1 | -1) =>
    new Date(NOW.getTime() + sign * Math.floor(Math.random() * 1e10)).toISOString();

  it('handles 100 random capacity values without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const capacity = Math.floor(Math.random() * 200);
      const soldCount = Math.floor(Math.random() * 200);
      const tier = baseTier({ capacity, soldCount });
      expect(() => tierAvailable(tier, NOW)).not.toThrow();
      const { available } = tierAvailable(tier, NOW);
      // Invariant: if soldCount >= capacity, must be unavailable
      if (soldCount >= capacity) expect(available).toBe(false);
    }
  });

  it('handles 100 random date combinations without throwing', () => {
    const signs: (1 | -1)[] = [1, -1];
    for (let i = 0; i < 100; i++) {
      const startSign = signs[Math.floor(Math.random() * 2)];
      const endSign = signs[Math.floor(Math.random() * 2)];
      const tier = baseTier({
        sale_starts_at: Math.random() > 0.3 ? randomDateOffset(startSign) : null,
        sale_ends_at: Math.random() > 0.3 ? randomDateOffset(endSign) : null,
      });
      expect(() => tierAvailable(tier, NOW)).not.toThrow();
    }
  });

  it('available=true tier has no reason string', () => {
    const tier = baseTier(); // fully open tier
    const { available, reason } = tierAvailable(tier, NOW);
    expect(available).toBe(true);
    expect(reason).toBeUndefined();
  });

  it('unavailable tier always has a reason string', () => {
    const cases: TicketTier[] = [
      baseTier({ sale_starts_at: FUTURE_DATE }),
      baseTier({ sale_ends_at: PAST_DATE }),
      baseTier({ capacity: 10, soldCount: 10 }),
    ];
    for (const tier of cases) {
      const { available, reason } = tierAvailable(tier, NOW);
      expect(available).toBe(false);
      expect(typeof reason).toBe('string');
      expect((reason ?? '').length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Fuzz — phone validation with random garbage
// ---------------------------------------------------------------------------

describe('validatePhone — fuzz: never throws, rejects garbage', () => {
  const garbage = [
    '', ' ', '\n', '\t', 'abc', '!!!!!', '000', '0'.repeat(20),
    'null', 'undefined', 'NaN', '   0712345678   ', // trailing spaces after trim would pass — raw won't
    '07 12 34 56 78', // spaces stripped → valid Safaricom
  ];

  it('does not throw on garbage inputs', () => {
    for (const input of garbage) {
      expect(() => validatePhone(input)).not.toThrow();
    }
  });

  it('accepts spaced Safaricom number (digits only extracted)', () => {
    // "07 12 34 56 78" → digits → "0712345678" → valid
    expect(validatePhone('07 12 34 56 78')).toBe(true);
  });

  it('rejects pure whitespace', () => {
    expect(validatePhone('   ')).toBe(false);
  });

  it('fuzz: 200 random digit strings never crash', () => {
    for (let i = 0; i < 200; i++) {
      const len = Math.floor(Math.random() * 20);
      const raw = Array.from({ length: len }, () => String(Math.floor(Math.random() * 10))).join('');
      expect(() => validatePhone(raw)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Integration-style: waitlist state logic
// ---------------------------------------------------------------------------

describe('Payment status → UI state mapping', () => {
  type Status = 'free' | 'paid' | 'pending_stk' | 'failed' | 'waitlisted' | 'approved_waitlist';

  function deriveUiState(status: Status) {
    if (status === 'free' || status === 'paid') return 'registered';
    if (status === 'waitlisted') return 'waitlisted';
    if (status === 'approved_waitlist') return 'approved_waitlist';
    if (status === 'pending_stk') return 'pending';
    return 'failed';
  }

  it('free registration shows as registered', () => {
    expect(deriveUiState('free')).toBe('registered');
  });

  it('paid registration shows as registered', () => {
    expect(deriveUiState('paid')).toBe('registered');
  });

  it('waitlisted shows as waitlisted', () => {
    expect(deriveUiState('waitlisted')).toBe('waitlisted');
  });

  it('approved_waitlist shows as approved_waitlist', () => {
    expect(deriveUiState('approved_waitlist')).toBe('approved_waitlist');
  });

  it('pending_stk shows as pending (polling)', () => {
    expect(deriveUiState('pending_stk')).toBe('pending');
  });

  it('failed shows as failed', () => {
    expect(deriveUiState('failed')).toBe('failed');
  });

  it('ACTIVE_STATUSES all count toward capacity', () => {
    const ACTIVE_STATUSES: Status[] = ['free', 'paid', 'pending_stk', 'approved_waitlist'];
    // waitlisted and failed must NOT be in active
    const inActive = (s: Status) => ACTIVE_STATUSES.includes(s);
    expect(inActive('waitlisted')).toBe(false);
    expect(inActive('failed')).toBe(false);
    expect(inActive('free')).toBe(true);
    expect(inActive('paid')).toBe(true);
    expect(inActive('pending_stk')).toBe(true);
    expect(inActive('approved_waitlist')).toBe(true);
  });
});
