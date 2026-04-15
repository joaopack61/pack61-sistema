'use strict';
const { query, getClient, auditLog } = require('../database');
const financialService = require('./financialService');
const notificationService = require('./notificationService');

// SSE: lista de clientes conectados ao stream de disponíveis
const sseClients = [];

function addSseClient(res) {
  sseClients.push(res);
  res.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
}

function broadcastAvailable(order) {
  sseClients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify({ event: 'NEW_ORDER', order })}\n\n`);
    } catch {}
  });
}

async function logStatusHistory(orderId, fromStatus, toStatus, campoAlterado, userId, obs) {
  try {
    await query(
      'INSERT INTO order_status_history (order_id,from_status,to_status,campo_alterado,changed_by,observacao) VALUES ($1,$2,$3,$4,$5,$6)',
      [orderId, fromStatus || null, toStatus, campoAlterado || 'status', userId || null, obs || null]
    );
  } catch (e) {
    console.error('[Pack61] logStatusHistory erro:', e.message);
  }
}

async function changeStatus(orderId, newStatus, userId, obs) {
  const orderRes = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });

  const valid = ['pendente','em_producao','produzido','pronto_expedicao','entregue','cancelado'];
  if (!valid.includes(newStatus)) throw Object.assign(new Error('Status inválido'), { status: 400 });

  // Normalizar delivery_status nulo (pedidos antigos migrados)
  const currentDeliveryStatus = order.delivery_status || 'AGUARDANDO';

  let deliveryStatus = currentDeliveryStatus;
  if (newStatus === 'pronto_expedicao') deliveryStatus = 'DISPONIVEL';
  if (newStatus === 'cancelado') deliveryStatus = 'AGUARDANDO';

  await query(
    'UPDATE orders SET status=$1, delivery_status=$2, updated_at=now() WHERE id=$3',
    [newStatus, deliveryStatus, orderId]
  );

  await logStatusHistory(orderId, order.status, newStatus, 'status', userId, obs);
  if (deliveryStatus !== currentDeliveryStatus) {
    await logStatusHistory(orderId, currentDeliveryStatus, deliveryStatus, 'delivery_status', userId, 'Auto');
  }

  // Notificar motoristas via SSE quando pedido ficar disponível
  if (deliveryStatus === 'DISPONIVEL') {
    const updatedRes = await query(
      `SELECT o.*, c.name as client_name, c.address, c.cidade as city FROM orders o LEFT JOIN clients c ON o.client_id=c.id WHERE o.id=$1`,
      [orderId]
    );
    broadcastAvailable(updatedRes.rows[0]);
  }

  await auditLog(userId, 'order_status_changed', 'orders', orderId, { status: order.status }, { status: newStatus });
}

async function acceptDelivery(orderId, driverId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = res.rows[0];
    if (!order) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
    if (order.delivery_status !== 'DISPONIVEL') {
      throw Object.assign(new Error('Este pedido não está mais disponível. Outro motorista pode ter aceitado primeiro.'), { status: 409, code: 'ALREADY_TAKEN' });
    }

    const now = new Date().toISOString();
    await client.query(
      'UPDATE orders SET delivery_status=$1, driver_id=$2, assigned_at=$3, updated_at=now() WHERE id=$4',
      ['EM_ROTA', driverId, now, orderId]
    );
    await client.query('COMMIT');

    await logStatusHistory(orderId, 'DISPONIVEL', 'EM_ROTA', 'delivery_status', driverId, null);
    await notificationService.send(orderId, order.client_id, 'EM_ROTA');
    await auditLog(driverId, 'delivery_accepted', 'orders', orderId, null, { driver_id: driverId });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function completeDelivery(orderId, driverId, photoUrl, p5, p10, notes) {
  const orderRes = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  if (order.driver_id !== driverId) throw Object.assign(new Error('Você não é o motorista desta entrega'), { status: 403 });

  const now = new Date().toISOString();
  await query(
    `UPDATE orders SET delivery_status='ENTREGUE', delivered_at=$1, delivery_proof_url=$2, updated_at=now() WHERE id=$3`,
    [now, photoUrl || null, orderId]
  );

  await logStatusHistory(orderId, order.delivery_status, 'ENTREGUE', 'delivery_status', driverId, notes);

  if ((p5 || 0) > 0 || (p10 || 0) > 0) {
    await financialService.createTubeRecord(orderId, null, order.client_id, driverId, p5, p10);
  }

  await financialService.createPayment(orderId, order.client_id, order.total_value || order.valor_total || 0, order.condicao_pagamento);
  await notificationService.send(orderId, order.client_id, 'ENTREGUE');
  await auditLog(driverId, 'delivery_completed', 'orders', orderId, null, { photo: !!photoUrl });
}

async function attemptFailed(orderId, driverId, reason) {
  const orderRes = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  if (order.driver_id !== driverId) throw Object.assign(new Error('Você não é o motorista desta entrega'), { status: 403 });

  const attempts = (order.delivery_attempts || 0) + 1;
  await query(
    `UPDATE orders SET delivery_status='DISPONIVEL', delivery_attempts=$1, delivery_notes=$2, driver_id=NULL, assigned_at=NULL, updated_at=now() WHERE id=$3`,
    [attempts, reason || null, orderId]
  );
  await logStatusHistory(orderId, order.delivery_status, 'DISPONIVEL', 'delivery_status', driverId, `Tentativa falha: ${reason}`);
  await auditLog(driverId, 'delivery_attempt_failed', 'orders', orderId, null, { attempts, reason });
}

module.exports = { changeStatus, acceptDelivery, completeDelivery, attemptFailed, addSseClient, logStatusHistory };
