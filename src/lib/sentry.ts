import * as Sentry from '@sentry/react';

const messages = {
  boundary: 'Falha de renderização do Educart',
  browser: 'Erro não tratado no Educart',
  rejection: 'Promise rejeitada no Educart',
  operation: 'Falha de operação no Educart',
  auth: 'Falha de transporte de autenticação',
  rest: 'Falha de transporte REST',
  rpc: 'Falha de transporte RPC',
  functions: 'Falha de transporte de função',
} as const;
export type FailureCategory = keyof typeof messages;
const categories = Object.keys(messages) as FailureCategory[];
const isCategory = (value: unknown): value is FailureCategory =>
  typeof value === 'string' && categories.includes(value as FailureCategory);

export function validSentryDsn(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^(?:o\d+\.)?ingest(?:\.[a-z]{2})?\.sentry\.io$/.test(url.hostname) ||
      !/^[a-f0-9]{32}$/i.test(url.username) || url.password || url.port || url.search || url.hash ||
      !/^\/\d+\/?$/.test(url.pathname)) return;
    return url.toString();
  } catch { return; }
}

export function sanitizeSentryEvent(event: Sentry.ErrorEvent, release: string | undefined): Sentry.ErrorEvent | null {
  const category = event.tags?.category;
  if (!isCategory(category)) return null;
  // Deliberate allowlist: never copy raw exceptions, paths, URLs, user data or breadcrumbs.
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    level: 'error',
    message: messages[category],
    fingerprint: ['educart', category],
    tags: { category },
    environment: 'production',
    ...(release ? { release } : {}),
  };
}

let ready = false;
const last = new Map<FailureCategory, number>();
export function initSentry(): void {
  if (ready || !import.meta.env.PROD || import.meta.env.MODE !== 'production') return;
  const dsn = validSentryDsn(import.meta.env.VITE_SENTRY_DSN);
  if (!dsn) return;
  const candidate = import.meta.env.VITE_SENTRY_RELEASE;
  const release = typeof candidate === 'string' && /^[a-f0-9]{40}$/.test(candidate) ? candidate : undefined;
  try {
    Sentry.init({
      dsn, release, environment: 'production', defaultIntegrations: false,
      sendClientReports: false,
      replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
      beforeSendTransaction: () => null, beforeSendLog: () => null, beforeSendMetric: () => null,
      transportOptions: { fetchOptions: { referrerPolicy: 'no-referrer', credentials: 'omit' } },
      beforeSend: event => sanitizeSentryEvent(event, release),
    });
    ready = true;
  } catch { /* Telemetry must never prevent application startup. */ }
}

export function reportFailure(category: FailureCategory): void {
  if (!ready || !isCategory(category)) return;
  const now = Date.now();
  if (now - (last.get(category) ?? -Infinity) < 60_000) return;
  last.set(category, now);
  try { Sentry.captureMessage(messages[category], { level: 'error', tags: { category } }); }
  catch { /* Do not interfere with the application. */ }
}
