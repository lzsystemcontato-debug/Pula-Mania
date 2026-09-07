// Envia um aviso para o n8n quando algo acontece no site (ex: reserva nova),
// para que automações externas (WhatsApp, planilha, e-mail) possam reagir.
//
// Configuração: defina a variável de ambiente N8N_WEBHOOK_URL com a URL do
// webhook do n8n. Se não estiver definida, o site funciona normalmente sem
// enviar nada — a automação é totalmente opcional.
//
// Importante: isso NUNCA deve atrasar nem quebrar a resposta ao usuário do
// site. O aviso é disparado em segundo plano (fire-and-forget) com um tempo
// limite curto, e qualquer erro é apenas registrado no log do servidor.

const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const TIMEOUT_MS = 5000;

async function notifyN8n(event, payload) {
  if (!WEBHOOK_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...payload }),
      signal: controller.signal
    });
    if (!res.ok) {
      console.error(`[n8n webhook] resposta não-OK (${res.status}) para o evento "${event}"`);
    }
  } catch (err) {
    console.error(`[n8n webhook] falha ao notificar evento "${event}":`, err.message);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { notifyN8n };
