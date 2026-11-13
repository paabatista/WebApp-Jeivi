/**
 * Envío de correos. Proveedores gratuitos soportados:
 *  - Resend (EMAIL_PROVIDER=resend, RESEND_API_KEY) — 3.000/mes; requiere verificar el dominio de la iglesia.
 *  - Brevo  (EMAIL_PROVIDER=brevo,  BREVO_API_KEY)  — 300/día; basta con verificar el correo remitente.
 * Remitente: EMAIL_FROM, ej. "Jeivi <lectura@ministeriojesucristoimperiodevida.com>".
 */
export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  bajaUrl?: string;
}

function remitente() {
  const from = process.env.EMAIL_FROM || 'Jeivi <onboarding@resend.dev>';
  const m = from.match(/^(.*)<(.+)>$/);
  return m ? { nombre: m[1].trim(), email: m[2].trim(), crudo: from } : { nombre: 'Jeivi', email: from, crudo: from };
}

async function enviarResend(correos: Correo[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Falta RESEND_API_KEY');
  const r = remitente();
  let enviados = 0;
  for (let i = 0; i < correos.length; i += 100) {
    const lote = correos.slice(i, i + 100).map((c) => ({
      from: r.crudo,
      to: [c.para],
      subject: c.asunto,
      html: c.html,
      text: c.texto,
      headers: c.bajaUrl ? { 'List-Unsubscribe': `<${c.bajaUrl}>` } : undefined,
    }));
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    enviados += lote.length;
  }
  return enviados;
}

async function enviarBrevo(correos: Correo[]) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Falta BREVO_API_KEY');
  const r = remitente();
  let enviados = 0;
  for (const c of correos) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: r.nombre, email: r.email },
        to: [{ email: c.para }],
        subject: c.asunto,
        htmlContent: c.html,
        textContent: c.texto,
        headers: c.bajaUrl ? { 'List-Unsubscribe': `<${c.bajaUrl}>` } : undefined,
      }),
    });
    if (res.ok) enviados++;
    else console.error('Brevo', c.para, res.status, await res.text());
  }
  return enviados;
}

export function enviarCorreos(correos: Correo[]) {
  return (process.env.EMAIL_PROVIDER || 'resend').toLowerCase() === 'brevo' ? enviarBrevo(correos) : enviarResend(correos);
}
