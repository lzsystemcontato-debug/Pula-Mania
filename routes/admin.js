const express = require('express');
const { load, save, verifyPassword, hashPassword } = require('../lib/db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Não autenticado' });
}

// ---- Auth ----

router.post('/auth/login', (req, res) => {
  const db = load();
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }
  const admin = db.admin;
  if (username !== admin.username || !verifyPassword(password, admin.salt, admin.hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }
  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ ok: true, username });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/auth/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  res.json({ authenticated: false });
});

router.post('/auth/change-password', requireAuth, (req, res) => {
  const db = load();
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Senha atual e nova senha (mín. 6 caracteres) são obrigatórias.' });
  }
  const admin = db.admin;
  if (!verifyPassword(currentPassword, admin.salt, admin.hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  const { salt, hash } = hashPassword(newPassword);
  admin.salt = salt;
  admin.hash = hash;
  save();
  res.json({ ok: true });
});

// everything below requires authentication
router.use(requireAuth);

// ---- Dashboard stats ----

router.get('/stats', (req, res) => {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const pending = db.bookings.filter((b) => b.status === 'pending').length;
  const confirmedToday = db.bookings.filter((b) => b.status === 'confirmed' && b.eventDate === today).length;
  const next7Days = db.bookings.filter(
    (b) => b.status !== 'cancelled' && b.eventDate >= today && b.eventDate <= in7Str
  ).length;
  const totalProducts = db.products.filter((p) => p.active).length;

  res.json({ pending, confirmedToday, next7Days, totalProducts });
});

// ---- Bookings ----

router.get('/bookings', (req, res) => {
  const db = load();
  let list = [...db.bookings];
  const { status, from, to } = req.query;
  if (status) list = list.filter((b) => b.status === status);
  if (from) list = list.filter((b) => b.eventDate >= from);
  if (to) list = list.filter((b) => b.eventDate <= to);
  list.sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0));
  res.json(list);
});

router.patch('/bookings/:id', (req, res) => {
  const db = load();
  const booking = db.bookings.find((b) => b.id === Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'Reserva não encontrada.' });
  const { status, notes } = req.body || {};
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (status) {
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    booking.status = status;
  }
  if (typeof notes === 'string') booking.notes = notes;
  save();
  res.json({ booking });
});

router.delete('/bookings/:id', (req, res) => {
  const db = load();
  const idx = db.bookings.findIndex((b) => b.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Reserva não encontrada.' });
  db.bookings.splice(idx, 1);
  save();
  res.json({ ok: true });
});

// ---- Products ----

router.get('/products', (req, res) => {
  const db = load();
  res.json(db.products);
});

router.post('/products', (req, res) => {
  const db = load();
  const { name, description, price, capacity, size, minAge, icon, color, images } = req.body || {};
  if (!name || !price) return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
  const product = {
    id: db.nextIds.product++,
    name: String(name).trim(),
    description: description ? String(description).trim() : '',
    price: Number(price),
    capacity: capacity ? Number(capacity) : null,
    size: size ? String(size).trim() : '',
    minAge: minAge ? Number(minAge) : null,
    icon: icon || 'bounce',
    color: color || '#ff6b6b',
    images: Array.isArray(images) ? images.map((s) => String(s).trim()).filter(Boolean) : [],
    active: true
  };
  db.products.push(product);
  save();
  res.status(201).json({ product });
});

router.put('/products/:id', (req, res) => {
  const db = load();
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  const { name, description, price, capacity, size, minAge, icon, color, images, active } = req.body || {};
  if (name !== undefined) product.name = String(name).trim();
  if (description !== undefined) product.description = String(description).trim();
  if (price !== undefined) product.price = Number(price);
  if (capacity !== undefined) product.capacity = Number(capacity);
  if (size !== undefined) product.size = String(size).trim();
  if (minAge !== undefined) product.minAge = Number(minAge);
  if (icon !== undefined) product.icon = icon;
  if (color !== undefined) product.color = color;
  if (images !== undefined) {
    product.images = Array.isArray(images) ? images.map((s) => String(s).trim()).filter(Boolean) : [];
  }
  if (active !== undefined) product.active = Boolean(active);
  save();
  res.json({ product });
});

router.delete('/products/:id', (req, res) => {
  const db = load();
  const idx = db.products.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado.' });
  db.products.splice(idx, 1);
  save();
  res.json({ ok: true });
});

// ---- Blocked dates ----

router.get('/blocked-dates', (req, res) => {
  const db = load();
  res.json([...db.blockedDates].sort((a, b) => (a.date < b.date ? -1 : 1)));
});

router.post('/blocked-dates', (req, res) => {
  const db = load();
  const { date, reason } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Data é obrigatória.' });
  if (db.blockedDates.some((b) => b.date === date)) {
    return res.status(409).json({ error: 'Essa data já está bloqueada.' });
  }
  const blocked = { id: db.nextIds.blockedDate++, date, reason: reason || '' };
  db.blockedDates.push(blocked);
  save();
  res.status(201).json({ blocked });
});

router.delete('/blocked-dates/:id', (req, res) => {
  const db = load();
  const idx = db.blockedDates.findIndex((b) => b.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Bloqueio não encontrado.' });
  db.blockedDates.splice(idx, 1);
  save();
  res.json({ ok: true });
});

// ---- Settings ----

router.put('/settings', (req, res) => {
  const db = load();
  const { companyName, whatsapp, email, city, instagram, address, pricePerKm } = req.body || {};
  if (companyName !== undefined) db.settings.companyName = companyName;
  if (whatsapp !== undefined) db.settings.whatsapp = whatsapp;
  if (email !== undefined) db.settings.email = email;
  if (city !== undefined) db.settings.city = city;
  if (instagram !== undefined) db.settings.instagram = instagram;
  if (address !== undefined) db.settings.address = address;
  if (pricePerKm !== undefined) db.settings.pricePerKm = Number(pricePerKm) || 0;
  save();
  res.json({ settings: db.settings });
});

module.exports = router;
