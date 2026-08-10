const express = require('express');
const { load, save } = require('../lib/db');
const { getUnavailableDates, isDateAvailable, todayStr } = require('../lib/availability');

const router = express.Router();

// GET /api/settings
router.get('/settings', (req, res) => {
  const db = load();
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

// GET /api/availability?productId=1&year=2026&month=8
router.get('/availability', (req, res) => {
  const db = load();
  const productId = Number(req.query.productId);
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!productId || !year || !month) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }
  const unavailable = getUnavailableDates(db, productId, year, month);
  res.json({ unavailable });
});

// POST /api/bookings - create a booking request
router.post('/bookings', (req, res) => {
  const db = load();
  const { productId, customerName, phone, email, eventDate, address, notes } = req.body || {};

  if (!productId || !customerName || !phone || !eventDate || !address) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  const product = db.products.find((p) => p.id === Number(productId) && p.active);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

  if (eventDate < todayStr()) {
    return res.status(400).json({ error: 'Data inválida.' });
  }

  if (!isDateAvailable(db, product.id, eventDate)) {
    return res.status(409).json({ error: 'Essa data não está mais disponível para este item. Escolha outra data.' });
  }

  const booking = {
    id: db.nextIds.booking++,
    productId: product.id,
    productName: product.name,
    customerName: String(customerName).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : '',
    eventDate,
    address: String(address).trim(),
    notes: notes ? String(notes).trim() : '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.bookings.push(booking);
  save();

  res.status(201).json({ booking });
});

module.exports = router;
