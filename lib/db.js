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
        name: 'Cama Elástica Colorida 4x4m',
        description: 'Cama elástica tradicional colorida, ideal para festas infantis. Estrutura inflável segura com rede de proteção nas laterais.',
        price: 250,
        capacity: 8,
        size: '4x4 m',
        minAge: 3,
        icon: 'bounce',
        color: '#ff6b6b',
        active: true
      },
      {
        id: 2,
        name: 'Castelo Inflável Princesas',
        description: 'Castelo inflável temático com escorregador integrado. Sucesso garantido entre as crianças.',
        price: 320,
        capacity: 10,
        size: '5x5 m',
        minAge: 2,
        icon: 'castle',
        color: '#c084fc',
        active: true
      },
      {
        id: 3,
        name: 'Piscina de Bolinhas + Cama Elástica',
        description: 'Combo com piscina de bolinhas e cama elástica, perfeito para os pequenos brincarem em segurança.',
        price: 280,
        capacity: 6,
        size: '3x4 m',
        minAge: 1,
        icon: 'balls',
        color: '#4dd0e1',
        active: true
      },
      {
        id: 4,
        name: 'Tobogã Inflável Gigante',
        description: 'Escorregador inflável de grande porte, com subida em rampa e chegada em colchão de ar.',
        price: 380,
        capacity: 12,
        size: '6x3 m',
        minAge: 4,
        icon: 'slide',
        color: '#ffb703',
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
      companyName: '[Nome da Empresa]',
      whatsapp: '[WhatsApp]',
      email: '[email@empresa.com]',
      city: '[Cidade/Região atendida]',
      instagram: '[@instagram]'
    },
    nextIds: { product: 5, booking: 1, blockedDate: 1 }
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DB_PATH)) {
    cache = defaultData();
    save();
  } else {
    cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  }
  return cache;
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

module.exports = { load, save, hashPassword, verifyPassword };
