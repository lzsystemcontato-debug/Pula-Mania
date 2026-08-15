# Pula Mania — Site de Agendamento para Locação de Cama Elástica

Site completo com catálogo, calendário de disponibilidade, formulário de reservas e painel administrativo.

## Como rodar

```bash
npm install
npm start
```

O site abre em `http://localhost:3000` e o painel administrativo em `http://localhost:3000/admin`.

**Login padrão do admin:** usuário `admin`, senha `pulamania123` (troque em Configurações após o primeiro acesso).

## Estrutura

- `server.js` — servidor Express
- `routes/public.js` — API pública (produtos, disponibilidade, criação de reserva)
- `routes/admin.js` — API do painel admin (login, reservas, produtos, bloqueio de datas, configurações)
- `lib/db.js` — persistência de dados: usa Firestore (Firebase) quando a variável de ambiente `FIREBASE_SERVICE_ACCOUNT`
  (ou `GOOGLE_APPLICATION_CREDENTIALS`) está definida (produção); caso contrário, usa um arquivo JSON local
  (`data/db.json`) como alternativa simples para rodar sem banco de dados durante o desenvolvimento.
- `public/` — site público (HTML/CSS/JS puro)
- `public/admin/` — painel administrativo

## Personalizar

- **Dados da empresa** (nome, WhatsApp, e-mail, cidade, Instagram): edite em Painel Admin → Configurações.
- **Produtos/brinquedos**: edite em Painel Admin → Produtos (adicionar, editar preço, foto/ícone, ativar/desativar).
- **Bloquear datas** (feriados, manutenção): Painel Admin → Datas bloqueadas.
- Os dados ficam salvos em `data/db.json`. Faça backup desse arquivo periodicamente.

## Publicar online

**Importante:** este é um app Node.js com servidor (Express) — ele **não funciona em hospedagem só-estática** como
Netlify, GitHub Pages ou Vercel (modo estático). Use um serviço que rode Node de verdade, como Render, Railway ou um
VPS.

### Publicar no Render (recomendado, gratuito)

1. Crie um repositório no GitHub e envie este projeto para lá (veja comandos abaixo).
2. Crie uma conta em [render.com](https://render.com) (pode entrar com sua conta do GitHub).
3. No painel do Render, clique em **New +** → **Blueprint**, selecione o repositório — o Render vai detectar o
   arquivo `render.yaml` deste projeto e configurar tudo automaticamente (build `npm install`, start `npm start`).
   - Se preferir configurar manualmente: **New +** → **Web Service** → selecione o repositório → Build Command
     `npm install` → Start Command `npm start`.
4. Aguarde o deploy. O Render vai te dar uma URL do tipo `https://pula-mania.onrender.com`.
5. Acesse `/admin` na URL publicada e troque a senha padrão do admin imediatamente.

**Comandos para enviar o projeto ao GitHub** (crie primeiro um repositório vazio em github.com/new, depois rode):

```bash
git add .
git commit -m "Site Pula Mania"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pula-mania.git
git push -u origin main
```

### Banco de dados (Firestore / Firebase)

O site usa o **Firestore** (banco do Firebase) para persistir produtos, reservas e configurações em produção. Sem
isso configurado, roda com um arquivo JSON local (`data/db.json`), que é apagado a cada novo deploy no Render.

**Configurar (uma vez só):**

1. No [Console do Firebase](https://console.firebase.google.com), abra o projeto (ex: `Pula Mania`) → **Compilação**
   → **Firestore Database** → **Criar banco de dados** (escolha uma localização, ex: `southamerica-east1`, e modo
   de produção).
2. Vá em **Configurações do projeto** (ícone de engrenagem) → **Contas de serviço** → **Gerar nova chave privada**.
   Isso baixa um arquivo `.json` — **guarde-o em local seguro, nunca comite no git**.
3. No painel do Render (Dashboard → serviço `pula-mania` → **Environment**), adicione a variável de ambiente
   `FIREBASE_SERVICE_ACCOUNT` colando **o conteúdo inteiro** desse arquivo `.json` (como uma única string).
4. Rode `npm install` (adiciona o pacote `firebase-admin`) e faça o deploy. O `render.yaml` já declara essa variável
   (sem valor — você preenche manualmente pelo painel, pois é um segredo).

Para rodar localmente com Firestore, defina a mesma variável `FIREBASE_SERVICE_ACCOUNT` no seu ambiente (ou aponte
`GOOGLE_APPLICATION_CREDENTIALS` para o caminho do arquivo `.json` baixado) antes de `npm start`.
