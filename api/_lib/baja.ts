import { createHmac, timingSafeEqual } from 'node:crypto';

const secreto = () => process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'cambia-este-secreto';

export function firmaBaja(uid: string) {
  return createHmac('sha256', secreto()).update(uid).digest('hex').slice(0, 32);
}

export function firmaValida(uid: string, firma: string) {
  const a = Buffer.from(firmaBaja(uid));
  const b = Buffer.from(firma || '');
  return a.length === b.length && timingSafeEqual(a, b);
}
