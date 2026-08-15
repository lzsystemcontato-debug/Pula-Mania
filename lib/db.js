const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const USE_FIRESTORE = !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);

let firestore = null;
if (USE_FIRESTORE) {
  const admin = require('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // GOOGLE_APPLICATION_CREDENTIALS points at a JSON key file on disk.
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  firestore = admin.firestore();
}

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
        name: 'Cama Elástica 1',
        description: 'Cama elástica com rede de proteção nas laterais e escada de acesso, ideal para festas infantis com total segurança. Diária de até 5 horas.',
        price: 140,
        capacity: 8,
        size: '3,5 m diâmetro',
        minAge: 3,
        icon: 'bounce',
        color: '#ff6b6b',
        images: ['/img/products/cama-elastica.jpg'],
        active: true,
        comboPartnerId: 3,
        comboPrice: 200
      },
      {
        id: 3,
        name: 'Piscina de Bolinhas',
        description: 'Piscina de bolinhas coberta, com rede de proteção nas laterais, perfeita para os pequenos brincarem em segurança. Diária de até 5 horas.',
        price: 100,
        capacity: 6,
        size: '1,5 m x 1,5 m',
        minAge: 1,
        icon: 'balls',
        color: '#4dd0e1',
        images: ['/img/products/piscina-bolinhas.jpg'],
        active: true,
        comboPartnerId: null,
        comboPrice: null
      },
      {
        id: 6,
        name: 'Cama Elástica 2',
        description: 'Segunda unidade de cama elástica com rede de proteção nas laterais e escada de acesso, ideal para festas infantis com total segurança. Diária de até 5 horas.',
        price: 140,
        capacity: 8,
        size: '3,5 m diâmetro',
        minAge: 3,
        icon: 'bounce',
        color: '#4968d4',
        images: ['/img/products/cama-elastica.jpg'],
        active: true,
        comboPartnerId: 3,
        comboPrice: 200
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
      address: 'R. Japurá, 4403 - Jardim Jandaia, Ribeirão Preto - SP',
      pricePerKm: 2
    },
    nextIds: { product: 7, booking: 1, blockedDate: 1 }
  };
}

function migrate(db) {
  db.products.forEach((p) => {
    if (!Array.isArray(p.images)) {
      p.images = p.image ? [p.image] : [];
      delete p.image;
    }
    if (p.comboPartnerId === undefined) p.comboPartnerId = null;
    if (p.comboPrice === undefined) p.comboPrice = null;
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
    if (typeof b.days !== 'number') b.days = 1;
    if (!b.endDate) b.endDate = b.eventDate;
  });

  return db;
}

// ---- Firestore-backed persistence (production, when Firebase credentials are set) ----

const STATE_DOC = firestore ? firestore.collection('app_state').doc('main') : null;

// On first run against a brand-new (empty) Firestore database, seed it from the
// bundled data/db.json if present — this carries over real data (products,
// existing bookings) that shipped with the deploy instead of resetting to the
// bare defaults. Later runs always read from Firestore, never from the file.
function seedData() {
  if (fs.existsSync(DB_PATH)) {
    return migrate(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
  }
  return migrate(defaultData());
}

async function loadFromFirestore() {
  const snap = await STATE_DOC.get();
  if (!snap.exists) {
    const fresh = seedData();
    await STATE_DOC.set({ data: fresh });
    return fresh;
  }
  return migrate(snap.data().data);
}

async function saveToFirestore(db) {
  await STATE_DOC.set({ data: db });
}

// ---- File-backed persistence (local development fallback) ----

let memCache = null;

function loadFromFile() {
  if (memCache) return memCache;
  if (!fs.existsSync(DB_PATH)) {
    memCache = defaultData();
    fs.writeFileSync(DB_PATH, JSON.stringify(memCache, null, 2), 'utf8');
  } else {
    memCache = migrate(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
  }
  return memCache;
}

function saveToFile(db) {
  memCache = db;
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// ---- Public API ----

async function load() {
  return USE_FIRESTORE ? loadFromFirestore() : loadFromFile();
}

async function save(db) {
  return USE_FIRESTORE ? saveToFirestore(db) : saveToFile(db);
}

module.exports = { load, save, hashPassword, verifyPassword, usingFirestore: USE_FIRESTORE };
