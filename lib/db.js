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

// Contrato de locação da própria Pula Mania (fornecido pelo dono do negócio).
// Os dados de cada pedido (partes, data, valores, equipamentos) aparecem no
// resumo mostrado acima deste texto na página de assinatura — aqui ficam só
// as cláusulas fixas. Editável em Painel Admin → Configurações.
const DEFAULT_RENTAL_TERMS = `CONTRATO DE LOCAÇÃO DE PULA-PULA E PISCINA DE BOLINHAS

Pelas partes identificadas no resumo do pedido acima, têm entre si justo e contratado o presente Contrato de Locação de Equipamentos Recreativos, mediante as cláusulas e condições seguintes:

1. DO OBJETO DA LOCAÇÃO
O presente contrato tem como objeto a locação dos equipamentos recreativos detalhados no resumo do pedido acima, que deverão ser utilizados exclusivamente para a finalidade a que se destinam e de acordo com as regras estabelecidas neste contrato.

2. REGRAS DE USO DO PULA-PULA
Para garantir a segurança dos usuários e a conservação do equipamento, deverão ser observadas obrigatoriamente as seguintes regras:
1. O pula-pula comporta no máximo 4 crianças por vez.
2. É proibido ultrapassar a capacidade máxima do equipamento.
3. A utilização deverá ocorrer sempre sob supervisão de um adulto responsável.
4. É obrigatório retirar os calçados antes de entrar no equipamento.
5. É proibida a entrada com alimentos ou bebidas.
6. É proibida a entrada com objetos pontiagudos, brinquedos ou objetos que possam danificar a lona.
7. Não é permitido empurrar, agarrar, chutar ou realizar brincadeiras que possam causar acidentes.
8. Não são permitidas cambalhotas ou movimentos considerados perigosos.
9. É proibido subir, pendurar-se ou apoiar-se nas partes externas do equipamento.
10. É proibido utilizar o equipamento com objetos ou acessórios que possam causar rasgos ou furos.
11. O equipamento não poderá ser deslocado, desmontado ou modificado pelo LOCATÁRIO(A).
12. Em caso de chuva, ventos fortes ou qualquer condição que comprometa a segurança, o equipamento deverá ser imediatamente desocupado.

3. REGRAS DE USO DA PISCINA DE BOLINHAS
1. A piscina de bolinhas comporta no máximo 4 crianças por vez.
2. É proibido ultrapassar a capacidade máxima.
3. A utilização deverá ocorrer sob supervisão de um adulto responsável.
4. É obrigatório retirar os calçados antes de entrar.
5. É proibida a entrada com alimentos ou bebidas.
6. Não é permitido entrar com objetos pontiagudos ou objetos que possam danificar a estrutura.
7. É proibido subir, sentar ou pendurar-se nas laterais da piscina.
8. É proibido retirar intencionalmente as bolinhas do interior da piscina.
9. As bolinhas não deverão ser levadas para outras áreas do evento.
10. É proibido utilizar a piscina de forma inadequada ou realizar brincadeiras que possam causar acidentes.
11. A piscina não poderá ser deslocada, desmontada ou modificada pelo LOCATÁRIO(A).

4. RESPONSABILIDADE PELA CONSERVAÇÃO
A partir da instalação e entrega dos equipamentos para utilização, o LOCATÁRIO(A) será responsável pela conservação e utilização adequada dos mesmos durante todo o período contratado.
O LOCATÁRIO(A) deverá garantir o cumprimento das regras de utilização e a supervisão das crianças.
Qualquer dano causado aos equipamentos em decorrência de mau uso, negligência, vandalismo ou descumprimento das regras estabelecidas neste contrato será de responsabilidade do LOCATÁRIO(A).

5. PAGAMENTO DE DANOS
Todos os danos causados aos equipamentos durante o período de locação, quando decorrentes de uso inadequado ou descumprimento das regras estabelecidas neste contrato, deverão ser pagos pelo LOCATÁRIO(A) no mesmo dia da ocorrência.
A LOCADORA poderá avaliar o dano e informar o valor necessário para reparo, substituição ou reposição do item danificado. O pagamento deverá ser realizado imediatamente após a identificação do dano.
São considerados exemplos de danos decorrentes de mau uso: rasgos ou furos na lona; danos causados por objetos pontiagudos; danos causados por calçados; danos decorrentes de deslocamento indevido; quebra ou perda de componentes; danos causados por alimentos ou bebidas; perda ou dano das bolinhas; qualquer outro dano decorrente da utilização em desacordo com as regras deste contrato.

6. LOCAL E CONDIÇÕES DE INSTALAÇÃO
Os equipamentos serão instalados no endereço informado pelo LOCATÁRIO(A). O LOCATÁRIO(A) deverá disponibilizar espaço adequado, seguro, nivelado e livre de objetos que possam danificar os equipamentos.
É proibido desmontar, modificar, arrastar ou tentar reparar os equipamentos sem autorização da LOCADORA.

7. SUPERVISÃO DAS CRIANÇAS
A supervisão das crianças durante todo o período de utilização dos equipamentos será de responsabilidade do LOCATÁRIO(A) ou de adulto por ele(a) designado.
A LOCADORA não será responsável por acidentes decorrentes do descumprimento das regras de utilização, da falta de supervisão ou do uso inadequado dos equipamentos.

8. CANCELAMENTO E SINAL
O valor pago como sinal ficará vinculado à reserva da data e aos custos relacionados à organização e deslocamento para realização da locação.
Em caso de cancelamento pelo LOCATÁRIO(A), a devolução ou utilização do sinal em eventual remarcação ficará sujeita à disponibilidade de nova data e acordo entre as partes.

9. ENCERRAMENTO DA LOCAÇÃO
A locação terá a duração do período contratado no pedido acima. Ao término do período contratado, os usuários deverão desocupar os equipamentos para que a LOCADORA possa realizar a retirada.
Caso o LOCATÁRIO(A) solicite a permanência dos equipamentos por período superior ao contratado, a extensão dependerá de disponibilidade e poderá gerar cobrança adicional, previamente acordada entre as partes.

10. DISPOSIÇÕES GERAIS
O LOCATÁRIO(A) declara ter recebido as orientações referentes ao uso correto dos equipamentos e estar ciente de todas as regras estabelecidas neste contrato.
O descumprimento das regras de segurança poderá resultar na interrupção da utilização dos equipamentos, sem que isso gere direito à restituição do valor pago.
Eventuais alterações ou acordos adicionais deverão ser previamente acordados entre as partes.

E, por estarem de acordo com todas as condições estabelecidas, as partes assinam o presente contrato ao aceitar estes termos abaixo.`;

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
      pricePerKm: 2,
      rentalTerms: DEFAULT_RENTAL_TERMS,
      ownerFullName: '',
      ownerCpf: ''
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
  if (typeof db.settings.rentalTerms !== 'string' || !db.settings.rentalTerms) {
    db.settings.rentalTerms = DEFAULT_RENTAL_TERMS;
  }
  if (typeof db.settings.ownerFullName !== 'string') db.settings.ownerFullName = '';
  if (typeof db.settings.ownerCpf !== 'string') db.settings.ownerCpf = '';

  db.bookings.forEach((b) => {
    if (typeof b.depositPaid !== 'boolean') b.depositPaid = false;
    if (b.contractToken === undefined) b.contractToken = null;
    if (b.contractSignedAt === undefined) b.contractSignedAt = null;
    if (b.contractSignature === undefined) b.contractSignature = null;
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

// On first run against a brand-new (empty) Firestore database, seed products/
// settings from the bundled data/db.json if present (so a fresh production
// database isn't stuck with bare placeholder products). Bookings are
// deliberately NEVER carried over from that file — it's the local dev/test
// file, and any bookings in it are development data, not real customer
// orders. A fresh production database always starts with an empty bookings
// list. Later runs always read from Firestore, never from the file.
function seedData() {
  const base = fs.existsSync(DB_PATH)
    ? migrate(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')))
    : migrate(defaultData());
  base.bookings = [];
  return base;
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

module.exports = { load, save, hashPassword, verifyPassword, usingFirestore: USE_FIRESTORE, DEFAULT_RENTAL_TERMS };
