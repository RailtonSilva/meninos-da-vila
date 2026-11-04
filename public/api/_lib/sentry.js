import * as Sentry from '@sentry/node';

let ready = false;

function init() {
  if (ready || !process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0,
  });
  ready = true;
}

export function captureError(err, context = {}) {
  console.error(err);
  init();
  if (ready) Sentry.captureException(err, { extra: context });
}

/** Funções serverless congelam após a resposta: espere o envio ao Sentry terminar. */
export async function flushSentry() {
  if (ready) await Sentry.flush(2000);
}
