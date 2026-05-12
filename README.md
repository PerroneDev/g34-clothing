# G34 Clothing - Sistema de Pedidos

Plataforma de E-commerce e Gestão de Pedidos para camisas do Congresso, integrando vitrine para clientes, painel administrativo para liderança e automação de notificações via WhatsApp.

## Estrutura do Projeto

O projeto é dividido em duas partes principais:

- **Backend (`/`):** API em Node.js (Express) conectada ao MongoDB. Conta com integração via `whatsapp-web.js` (RemoteAuth via `wwebjs-mongo`) para enviar mensagens e alertas automáticos de forma invisível.
- **Frontend (`/frontend`):** Construído em React + Vite. Possui a loja pública (mobile-first) e o painel de administração (protegido por Google Login).

## Funcionalidades
- 🛒 **Vitrine e Carrinho:** Escolha de estampas, tecidos e tabela de tamanhos.
- 💳 **Checkout Otimizado:** Pagamentos previstos para PIX, Cartão de Crédito e Dinheiro.
- 💬 **WhatsApp Bot:** Notificações automáticas no celular do cliente (Confirmação, Pagamento Aprovado e Pedido Pronto).
- 🔐 **Painel Admin Seguro:** Login restrito com conta Google.
- ✂️ **Gestão de Produção:** Acompanhamento de estamparias linha a linha.
- 📊 **Dashboard Financeiro:** Totais de faturamento, quantidade de peças e ticket médio.

## Como rodar localmente

### 1. Backend
```bash
# Na pasta raiz
npm install
node server.js
```

### 2. Frontend
```bash
# Em outro terminal
cd frontend
npm install
npm run dev
```

> É necessário configurar o `.env` tanto na raiz quanto na pasta frontend com as suas credenciais.
