import { describe, expect, it } from 'vitest';
import { coercePreferences, DEFAULT_PREFERENCES } from '@/lib/browser/preferences';

describe('coercePreferences', () => {
  it('falls back to defaults for junk input', () => {
    expect(coercePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(coercePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(coercePreferences('nope' as unknown)).toEqual(DEFAULT_PREFERENCES);
    expect(coercePreferences(42 as unknown)).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid values and coerces invalid ones per-key', () => {
    expect(
      coercePreferences({ theme: 'dark', indent: 4, wrap: false, defaultView: 'code', losslessNumbers: false }),
    ).toEqual({ theme: 'dark', indent: 4, wrap: false, defaultView: 'code', losslessNumbers: false });
    expect(
      coercePreferences({ theme: 'nope', indent: 3, wrap: 'yes', defaultView: 'magic', losslessNumbers: 'on' }),
    ).toEqual(DEFAULT_PREFERENCES);
  });

  it('defaults losslessNumbers on and accepts explicit booleans', () => {
    expect(coercePreferences({}).losslessNumbers).toBe(true);
    expect(coercePreferences({ losslessNumbers: false }).losslessNumbers).toBe(false);
  });

  it('is resilient to prototype pollution attempts', () => {
    expect(() => coercePreferences({ __proto__: { theme: 'dark' } })).not.toThrow();
    expect(coercePreferences({ __proto__: { theme: 'dark' } }).theme).toBe('system');
  });
});
