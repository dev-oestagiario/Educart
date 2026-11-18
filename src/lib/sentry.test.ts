import { describe, expect, it } from 'vitest';
import { sanitizeSentryEvent, validSentryDsn } from './sentry';
describe('Sentry: privacy and configuration', () => {
  it('accepts only HTTPS Sentry ingestion DSNs', () => {
    const dsn = 'https://0123456789abcdef0123456789abcdef@o123.ingest.us.sentry.io/456';
    expect(validSentryDsn(dsn)).toBe(dsn);
    for (const bad of ['', 'https://example.org/123', dsn.replace('https:', 'http:'), dsn + '?secret=1', dsn.replace('sentry.io', 'sentry.io.evil.org')]) expect(validSentryDsn(bad)).toBeUndefined();
  });
  it('emits only fixed diagnostic categories and approved metadata', () => {
    const event = sanitizeSentryEvent({ type: undefined,
      tags: { category: 'rpc', private: 'sensitive' },
      message: 'sensitive', user: { email: 'private@example.org' },
      request: { url: 'https://example.org/?token=sensitive' },
      extra: { personal: 'sensitive' }, breadcrumbs: [{ message: 'sensitive' }],
      exception: { values: [{ value: 'sensitive' }] },
    }, 'a'.repeat(40));
    expect(event).toEqual({
      type: undefined, event_id: undefined, timestamp: undefined, platform: 'javascript', level: 'error',
      message: 'Falha de transporte RPC', fingerprint: ['educart', 'rpc'],
      tags: { category: 'rpc' }, environment: 'production', release: 'a'.repeat(40),
    });
    expect(JSON.stringify(event)).not.toContain('sensitive');
  });
  it('drops unrecognized events', () => {
    expect(sanitizeSentryEvent({ type: undefined, message: 'sensitive' }, undefined)).toBeNull();
    expect(sanitizeSentryEvent({ type: undefined, tags: { category: 'sensitive' } }, undefined)).toBeNull();
  });
});
