const express = require('express');
const { load, save } = require('../lib/db');
const { getUnavailableDates, isDateAvailable, isRangeAvailable, addDays, todayStr } = require('../lib/availability');
const { distanceBetweenAddresses } = require('../lib/geo');
const { computeDailySubtotal } = require('../lib/pricing');

const router = express.Router();

// GET /api/settings
router.get('/settings', (req, res) => {
  const db = load();
  // don't leak the internal price-per-km / origin address needed only for calc consistency,
  // but they're needed by the public booking form to show the rate — safe to expose.
  res.json(db.settings);
});

// GET /api/products - list active products
router.get('/products', (req, res) => {
  const db = load();
  res.json(db.products.filter((p) => p.active));
});

// GET /api/products/:id
router.get('/products/:id', (req, res) => {
  const db = load();
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(product);
});

// GET /api/availability?productIds=1,2,3&year=2026&month=8
router.get('/availability', (req, res) => {
  const db = load();
  const productIds = String(req.query.productIds || req.query.productId || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!productIds.length || !year || !month) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }
  const unavailable = getUnavailableDates(db, productIds, year, month);
  res.json({ unavailable });
});

// POST /api/distance - { address } -> { km }
router.post('/distance', async (req, res) => {
  const db = load();
  const { address } = req.body || {};
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: 'Informe o endereço do evento.' });
  }
  if (!db.settings.address) {
    return res.status(400).json({
      error: 'O endereço da empresa ainda não foi configurado no painel administrativo. A taxa de deslocamento não pode ser calculada agora.'
    });
  }
  try {
    const km = await distanceBetweenAddresses(db.settings.address, String(address).trim());
    res.json({ km, pricePerKm: db.settings.pricePerKm });
  } catch (err) {
    res.status(422).json({ error: err.message || 'Não foi possível calcular a distância para este endereço.' });
  }
});

// POST /api/bookings - create a booking request with one or more products
router.post('/bookings', (req, res) => {
  const db = load();
  const { productIds, customerName, phone, email, eventDate, address, notes, distanceKm, days } = req.body || {};

  const ids = Array.isArray(productIds) ? productIds.map(Number).filter(Boolean) : [];
  const numDays = Math.max(1, Math.min(60, Number(days) || 1));

  if (!ids.length || !customerName || !phone || !eventDate || !address) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios e selecione ao menos um brinquedo.' });
  }

  const products = ids.map((id) => db.products.find((p) => p.id === id && p.active)).filter(Boolean);
  if (products.length !== ids.length) {
    return res.status(404).json({ error: 'Um ou mais brinquedos selecionados não foram encontrados.' });
  }

  if (eventDate < todayStr()) {
    return res.status(400).json({ error: 'Data inválida.' });
  }

  if (!isRangeAvailable(db, ids, eventDate, numDays)) {
    return res.status(409).json({ error: 'Esse período não está mais disponível para um dos brinquedos selecionados. Escolha outra data ou reduza a quantidade de dias.' });
  }

  const endDate = addDays(eventDate, numDays - 1);
  const items = products.map((p) => ({ productId: p.id, name: p.name, price: p.price }));
  const subtotal = Math.round(computeDailySubtotal(products) * numDays * 100) / 100;
  const km = Number(distanceKm) > 0 ? Number(distanceKm) : 0;
  const travelFee = Math.round(km * db.settings.pricePerKm * 100) / 100;
  const total = Math.round((subtotal + travelFee) * 100) / 100;

  const booking = {
    id: db.nextIds.booking++,
    items,
    customerName: String(customerName).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : '',
    eventDate,
    endDate,
    days: numDays,
    address: String(address).trim(),
    notes: notes ? String(notes).trim() : '',
    distanceKm: km,
    travelFee,
    subtotal,
    total,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.bookings.push(booking);
  save();

  res.status(201).json({ booking });
});

module.exports = router;
