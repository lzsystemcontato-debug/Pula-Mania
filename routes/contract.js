const express = require('express');
const { load, save } = require('../lib/db');

const router = express.Router();

function findBooking(db, token) {
  return db.bookings.find((b) => b.contractToken && b.contractToken === token);
}

// GET /api/contract/:token — dados do pedido + termos, para a página de assinatura.
router.get('/:token', async (req, res) => {
  const db = await load();
  const booking = findBooking(db, req.params.token);
  if (!booking) return res.status(404).json({ error: 'Contrato não encontrado.' });

  res.json({
    companyName: db.settings.companyName,
    ownerFullName: db.settings.ownerFullName,
    ownerCpf: db.settings.ownerCpf,
    city: db.settings.city,
    rentalTerms: db.settings.rentalTerms,
    customerName: booking.customerName,
    address: booking.address,
    items: booking.items,
    eventDate: booking.eventDate,
    endDate: booking.endDate,
    days: booking.days,
    total: booking.total,
    alreadySigned: !!booking.contractSignedAt,
    signedAt: booking.contractSignedAt,
    signature: booking.contractSignedAt ? booking.contractSignature : null
  });
});

// POST /api/contract/:token/sign — cliente confirma os dados dele e aceita os termos.
router.post('/:token/sign', async (req, res) => {
  const db = await load();
  const booking = findBooking(db, req.params.token);
  if (!booking) return res.status(404).json({ error: 'Contrato não encontrado.' });
  if (booking.contractSignedAt) return res.status(409).json({ error: 'Este contrato já foi assinado.' });

  const { fullName, cpf, address, acceptedTerms } = req.body || {};
  const cpfDigits = String(cpf || '').replace(/\D/g, '');

  if (!fullName || !String(fullName).trim()) {
    return res.status(400).json({ error: 'Informe o nome completo.' });
  }
  if (cpfDigits.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF válido (11 dígitos).' });
  }
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: 'Informe o endereço.' });
  }
  if (acceptedTerms !== true) {
    return res.status(400).json({ error: 'É necessário aceitar os termos de locação para continuar.' });
  }

  const signedAt = new Date().toISOString();
  booking.contractSignature = {
    fullName: String(fullName).trim(),
    cpf: cpfDigits,
    address: String(address).trim(),
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
    signedAt
  };
  booking.contractSignedAt = signedAt;
  await save(db);

  res.json({ ok: true, signedAt });
});

module.exports = router;
