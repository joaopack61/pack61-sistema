'use strict';
const { query } = require('../database');

// Calcular data de vencimento com base na condição de pagamento
function calcVencimento(condicao) {
  const base = new Date();
  const dates = [];
  switch ((condicao || 'A_VISTA').toUpperCase()) {
    case 'A_VISTA':
      dates.push(new Date(base));
      break;
    case '30_DIAS':
      dates.push(new Date(base.setDate(base.getDate() + 30)));
      break;
    case '30_60': {
      const d1 = new Date(); d1.setDate(d1.getDate() + 30);
      const d2 = new Date(); d2.setDate(d2.getDate() + 60);
      dates.push(d1, d2);
      break;
    }
    case '30_60_90': {
      const d1 = new Date(); d1.setDate(d1.getDate() + 30);
      const d2 = new Date(); d2.setDate(d2.getDate() + 60);
      const d3 = new Date(); d3.setDate(d3.getDate() + 90);
      dates.push(d1, d2, d3);
      break;
    }
    default:
      dates.push(new Date());
  }
  return dates;
}

async function createPayment(orderId, clientId, valor, condicao) {
  const dates = calcVencimento(condicao);
  const parcela = parseFloat((valor / dates.length).toFixed(2));
  for (const dt of dates) {
    await query(
      'INSERT INTO payments (order_id, client_id, valor, forma_pagamento, data_vencimento, status) VALUES ($1,$2,$3,$4,$5,$6)',
      [orderId, clientId, parcela, 'BOLETO', dt.toISOString().split('T')[0], 'PENDENTE']
    );
  }
}

async function createTubeRecord(orderId, deliveryId, clientId, driverId, p5, p10) {
  const vp5 = parseFloat(((p5 || 0) * 0.5).toFixed(2));
  const vp10 = parseFloat(((p10 || 0) * 1.0).toFixed(2));
  await query(
    `INSERT INTO tube_financial (order_id, delivery_id, client_id, driver_id, quantidade_p5, quantidade_p10, valor_p5, valor_p10, valor_total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [orderId, deliveryId || null, clientId, driverId, p5 || 0, p10 || 0, vp5, vp10, parseFloat((vp5 + vp10).toFixed(2))]
  );
}

async function checkOverdue() {
  const result = await query(
    `UPDATE payments SET status = 'ATRASADO', updated_at = now()
     WHERE data_vencimento < CURRENT_DATE AND data_pagamento IS NULL AND status = 'PENDENTE'
     RETURNING id`
  );
  return result.rowCount;
}

module.exports = { createPayment, createTubeRecord, checkOverdue };
