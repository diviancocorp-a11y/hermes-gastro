/**
 * api/whatsapp.js — Vercel Serverless Function
 * Envía notificaciones de WhatsApp vía Twilio cuando cambia el estado de un pedido.
 *
 * Variables de entorno requeridas en Vercel:
 *   TWILIO_ACCOUNT_SID   — Account SID de tu cuenta Twilio
 *   TWILIO_AUTH_TOKEN    — Auth Token de tu cuenta Twilio
 *   TWILIO_WHATSAPP_FROM — Número Twilio en formato: whatsapp:+14155238886
 *
 * Activación de WhatsApp sandbox en Twilio:
 *   1. Ir a https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
 *   2. Conectar tu número al sandbox enviando el código indicado
 *   3. Para producción, solicitar un número aprobado por Meta
 */

const APP_URL = process.env.VITE_APP_URL || 'https://la-nona-pato.vercel.app';

const STATUS_MESSAGES = {
  prep:   (name) => `👩‍🍳 ¡Hola ${name}! Tu pedido de La Nona Pato ya está en preparación. Te avisamos cuando esté listo 🎂`,
  active: (name) => `🎁 ¡${name}, tu pedido está listo! Pasate a buscarlo o esperá al repartidor. ¡Gracias por elegirnos! 🦆`,
  done:   (name, trackUrl) => `✅ ¡Pedido entregado! Esperamos que lo disfrutes muchísimo 🤍\n\nSeguí el estado en cualquier momento: ${trackUrl}`,
  cancel: (name) => `❌ Hola ${name}, lamentablemente tuvimos que cancelar tu pedido. Escribinos por acá para más info.`,
};

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validar origen interno (header secreto)
  const secret = req.headers['x-nona-secret'];
  if (secret !== process.env.NONA_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { phone, customerName, status, orderId } = req.body;

  // Validaciones básicas
  if (!phone || !customerName || !status) {
    return res.status(400).json({ error: 'Missing required fields: phone, customerName, status' });
  }
  if (!STATUS_MESSAGES[status]) {
    return res.status(400).json({ error: `Status '${status}' has no message template` });
  }

  // Credenciales Twilio
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  // Limpiar y formatear el número (Argentina por defecto)
  const cleanPhone = phone.replace(/\D/g, '');
  const e164 = cleanPhone.startsWith('549') ? `+${cleanPhone}`
    : cleanPhone.startsWith('54') ? `+${cleanPhone}`
    : cleanPhone.length === 10 ? `+54${cleanPhone}`
    : `+54${cleanPhone}`;

  const trackUrl = orderId ? `${APP_URL}/order/${orderId}` : APP_URL;
  const body = STATUS_MESSAGES[status](customerName, trackUrl);

  // Llamada directa a la API REST de Twilio (sin SDK)
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  try {
    const twilioRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: `whatsapp:${e164}`,
        Body: body,
      }).toString(),
    });

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('Twilio error:', data);
      return res.status(500).json({ error: data.message || 'Twilio error', code: data.code });
    }

    return res.status(200).json({ ok: true, sid: data.sid, to: e164 });

  } catch (err) {
    console.error('WhatsApp handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
