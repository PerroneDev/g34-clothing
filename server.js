require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const Pedido = require('./models/Pedido');
const { inicializarWhatsApp, getWhatsAppStatus, enviarMensagemPedido, atualizarEtiquetaPedido, enviarMensagemAprovacao, enviarMensagemPronto } = require('./whatsapp');

const app = express();
app.use(cors());
app.use(express.json());

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Conexão com o Banco
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
      console.log('🍃 Conectado ao MongoDB - Sistema do Congresso');
      inicializarWhatsApp(mongoose);
  })
  .catch(err => console.error('Erro no banco:', err));

// ============================================
// ROTAS DA LOJA (PÚBLICAS)
// ============================================

app.get('/api/ping', (req, res) => res.send('pong'));

app.post('/api/pedidos', async (req, res) => {
    try {
        const novoPedido = new Pedido(req.body);
        const pedidoSalvo = await novoPedido.save();
        
        // Envia a mensagem do WhatsApp para o cliente em segundo plano
        enviarMensagemPedido(pedidoSalvo);
        
        res.status(201).json(pedidoSalvo);
    } catch (erro) {
        console.error("Erro ao salvar pedido:", erro);
        res.status(500).json({ erro: 'Erro ao processar pedido' });
    }
});

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO DO ADMIN
// ============================================
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Acesso Negado. Token não fornecido.' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
}

// ============================================
// ROTAS DO ADMIN (PROTEGIDAS)
// ============================================

// Login via Google OAuth
app.post('/api/admin/login', async (req, res) => {
    const { credential } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email;

        // Verifica se o e-mail bate com o cadastrado no .env
        if (email !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ erro: 'Email não autorizado pelo sistema.' });
        }

        // Gera o JWT para manter a sessão no React
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: { name: payload.name, picture: payload.picture } });
    } catch (error) {
        console.error("Erro no login do Google:", error);
        res.status(500).json({ erro: 'Falha na autenticação do Google' });
    }
});

// Listar todos os pedidos
app.get('/api/pedidos', verifyToken, async (req, res) => {
    try {
        const pedidos = await Pedido.find().sort({ dataPedido: -1 });
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar pedidos' });
    }
});

// Status do WhatsApp e QR Code
app.get('/api/whatsapp/status', verifyToken, (req, res) => {
    res.json(getWhatsAppStatus());
});

// Aprovar Pagamento do Pedido
app.put('/api/pedidos/:id/aprovar', verifyToken, async (req, res) => {
    try {
        const pedido = await Pedido.findById(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

        pedido.status = 'Em Produção'; 
        await pedido.save();

        // 1. Atualiza a Etiqueta no WhatsApp
        await atualizarEtiquetaPedido(pedido.telefone, 'Em Produção');
        
        // 2. Envia mensagem de agradecimento/confirmação pro cliente
        await enviarMensagemAprovacao(pedido.telefone);

        res.json(pedido);
    } catch (error) {
        console.error("Erro ao aprovar:", error);
        res.status(500).json({ erro: 'Erro ao aprovar pedido' });
    }
});

// Marcar Item como Pronto/Estampado
app.put('/api/pedidos/:pedidoId/item/:itemId/pronto', verifyToken, async (req, res) => {
    try {
        const pedido = await Pedido.findById(req.params.pedidoId);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

        let item = pedido.itens.id(req.params.itemId);
        
        // Fallback: se não achar por ID, tenta buscar pelo índice (útil para pedidos antigos sem _id)
        if (!item && !isNaN(req.params.itemId)) {
            item = pedido.itens[parseInt(req.params.itemId)];
        }

        if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

        item.pronto = !item.pronto; // Alterna o status
        
        // Verifica se todos os itens estão prontos
        const todosProntos = pedido.itens.every(i => i.pronto);
        if (todosProntos && pedido.status === 'Em Produção') {
            pedido.status = 'Aguardando Entrega';
            // Atualiza a Etiqueta no WhatsApp
            await atualizarEtiquetaPedido(pedido.telefone, 'Aguardando Entrega');
        } else if (!todosProntos && (pedido.status === 'Finalizado' || pedido.status === 'Aguardando Entrega')) {
            pedido.status = 'Em Produção';
            // Volta a Etiqueta no WhatsApp (opcional)
        }

        await pedido.save();
        res.json(pedido);
    } catch (error) {
        console.error("Erro ao atualizar item:", error);
        res.status(500).json({ erro: 'Erro ao atualizar item' });
    }
});

// Deletar Pedido
app.delete('/api/pedidos/:id', verifyToken, async (req, res) => {
    try {
        const pedido = await Pedido.findByIdAndDelete(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
        res.json({ mensagem: 'Pedido excluído com sucesso' });
    } catch (error) {
        console.error("Erro ao deletar:", error);
        res.status(500).json({ erro: 'Erro ao deletar pedido' });
    }
});

// Enviar mensagem de que o pedido está pronto
app.post('/api/pedidos/:id/notificar-pronto', verifyToken, async (req, res) => {
    try {
        const pedido = await Pedido.findById(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
        
        await enviarMensagemPronto(pedido.telefone);
        res.json({ mensagem: 'Notificação enviada com sucesso' });
    } catch (error) {
        console.error("Erro ao notificar pronto:", error);
        res.status(500).json({ erro: 'Erro ao enviar notificação' });
    }
});

// Marcar pedido como Entregue
app.put('/api/pedidos/:id/entregar', verifyToken, async (req, res) => {
    try {
        const pedido = await Pedido.findById(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

        pedido.status = 'Entregue';
        await pedido.save();
        
        await atualizarEtiquetaPedido(pedido.telefone, 'Entregue');

        res.json(pedido);
    } catch (error) {
        console.error("Erro ao marcar como entregue:", error);
        res.status(500).json({ erro: 'Erro ao marcar como entregue' });
    }
});

app.listen(3001, () => console.log('📡 API de Pedidos rodando na porta 3001'));