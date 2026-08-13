const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

function defaultData() {
  const { salt, hash } = hashPassword('pulamania123');
  return {
    products: [
      {
        id: 1,
        name: 'Cama Elástica Colorida',
        description: 'Cama elástica com rede de proteção nas laterais e escada de acesso, ideal para festas infantis com total segurança.',
        price: 250,
        capacity: 8,
        size: '4,20 m diâmetro',
        minAge: 3,
        icon: 'bounce',
        color: '#ff6b6b',
        images: ['/img/products/cama-elastica.jpg'],
        active: true
      },
      {
        id: 3,
        name: 'Piscina de Bolinhas',
        description: 'Piscina de bolinhas coberta, com rede de proteção nas laterais, perfeita para os pequenos brincarem em segurança.',
        price: 200,
        capacity: 6,
        size: '2x2 m',
        minAge: 1,
        icon: 'balls',
        color: '#4dd0e1',
        images: ['/img/products/piscina-bolinhas.jpg'],
        active: true
      }
    ],
    bookings: [],
    blockedDates: [],
    admin: {
      username: 'admin',
      salt,
      hash
    },
    settings: {
      companyName: 'Pula Mania',
      whatsapp: '16994381700',
      email: 'pulamaniafesta.rp@gmail.com',
      city: 'Ribeirão Preto',
      instagram: '@pulamania.rp',
      address: '',
      pricePerKm: 2
    },
    nextIds: { product: 4, booking: 1, blockedDate: 1 }
  };
}

function migrate(db) {
  db.products.forEach((p) => {
    if (!Array.isArray(p.images)) {
      p.images = p.image ? [p.image] : [];
      delete p.image;
    }
  });
  if (!db.settings.address) db.settings.address = '';
  if (typeof db.settings.pricePerKm !== 'number') db.settings.pricePerKm = 2;

  db.bookings.forEach((b) => {
    if (!Array.isArray(b.items)) {
      const product = db.products.find((p) => p.id === b.productId);
      const price = product ? product.price : 0;
      b.items = [{ productId: b.productId, name: b.productName || (product && product.name) || 'Item', price }];
      b.subtotal = price;
      b.distanceKm = 0;
      b.travelFee = 0;
      b.total = price;
      delete b.productId;
      delete b.productName;
    }
  });

  return db;
}

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DB_PATH)) {
    cache = defaultData();
    save();
  } else {
    cache = migrate(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
  }
  return cache;
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

module.exports = { load, save, hashPassword, verifyPassword };
