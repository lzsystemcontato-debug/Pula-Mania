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
- `lib/db.js` — banco de dados simples em arquivo JSON (`data/db.json`, criado automaticamente)
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

### Atenção: dados no plano gratuito do Render

Este projeto guarda reservas e produtos em um arquivo (`data/db.json`) no próprio servidor. No plano gratuito do
Render, o disco **não é permanente entre deploys** — ou seja, se você publicar uma atualização do código, os dados
salvos (reservas feitas pelos clientes, alterações no painel) podem ser perdidos. Para uso sério, considere:

- Ativar um "Persistent Disk" no Render (plano pago), ou
- Migrar para um banco de dados externo no futuro (ex: banco gratuito do Render/Railway).

Por enquanto, para começar a usar e validar o site, isso não é um bloqueio — apenas evite publicar novas alterações
de código com frequência sem antes anotar/exportar as reservas importantes.
