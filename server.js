const express = require('express');
const session = require('express-session');
const path = require('path');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const contractRoutes = require('./routes/contract');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Render (e qualquer host atrás de proxy/load balancer) termina o HTTPS antes
// do Node; sem isso, o Express nunca vê a conexão como "secure" e o cookie
// com secure:true nunca seria enviado de volta pelo navegador.
if (IS_PRODUCTION) app.set('trust proxy', 1);

app.use(express.json());
app.use(
  session({
    name: 'pulamania.sid',
    secret: process.env.SESSION_SECRET || 'pula-mania-dev-secret-troque-em-producao',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contract', contractRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.get('/contrato/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contrato.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pula Mania rodando em http://localhost:${PORT}`);
  console.log(`Painel admin em http://localhost:${PORT}/admin`);
});
