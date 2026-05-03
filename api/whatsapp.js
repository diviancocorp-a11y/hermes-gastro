// api/whatsapp.js — DEPRECATED AND REMOVED
// This webhook has been eliminated. WhatsApp notifications will be handled via
// an open source solution in the future.
// The UI buttons (wa.me links) in business.js remain intact.

export default function handler(req, res) {
  res.status(410).json({ error: 'This endpoint has been removed' });
}
