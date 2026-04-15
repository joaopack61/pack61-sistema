'use strict';
const { query } = require('../database');

async function send(orderId, clientId, event) {
  try {
    const clientRes = await query('SELECT contato_telefone, phone, name FROM clients WHERE id = $1', [clientId]);
    const client = clientRes.rows[0];
    const phone = client?.contato_telefone || client?.phone || 'sem telefone';

    const messages = {
      EM_ROTA: `Olá! Seu pedido #${orderId} está a caminho. Nosso motorista saiu para entrega. 🚚`,
      ENTREGUE: `Olá! Seu pedido #${orderId} foi entregue com sucesso. Obrigado pela preferência! ✅`,
    };

    const mensagem = messages[event] || `Pedido #${orderId} atualizado: ${event}`;

    await query(
      'INSERT INTO notification_log (order_id, client_id, canal, mensagem, status) VALUES ($1,$2,$3,$4,$5)',
      [orderId, clientId, 'WHATSAPP', mensagem, 'SIMULADO']
    );

    // TODO: Integrar com WhatsApp Business API ou Twilio quando credenciais estiverem disponíveis
    // const twilio = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    // await twilio.messages.create({ to: `whatsapp:+55${phone}`, from: 'whatsapp:+14155238886', body: mensagem });

    console.log(`[Pack61] Notificação SIMULADA → ${phone}: ${mensagem}`);
  } catch (e) {
    console.error('[Pack61] notificationService erro:', e.message);
  }
}

module.exports = { send };
