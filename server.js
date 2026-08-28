require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');

const Pedido = require('./models/Pedido');
const Produto = require('./models/Produto');
const Config = require('./models/Config');
const { inicializarWhatsApp, getWhatsAppStatus, enviarMensagemPedido, atualizarEtiquetaPedido, enviarMensagemAprovacao, enviarMensagemPronto } = require('./whatsapp');

const app = express();

// ============================================
// CORS — origens permitidas
// ============================================
const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://g34-clothing.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173'
];

app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (ex: curl, Postman) ou origens na whitelist
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================
// RATE LIMITING
// ============================================
const limiterGeral = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente em alguns segundos.' }
});

const limiterPedidos = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { erro: 'Limite de pedidos atingido. Tente novamente em 1 minuto.' }
});

const limiterLogin = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { erro: 'Muitas tentativas de login. Aguarde 1 minuto.' }
});

app.use('/api/', limiterGeral);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Conexão com o Banco
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('🍃 Conectado ao MongoDB - Sistema do Congresso');
        inicializarWhatsApp();
    })
    .catch(err => console.error('Erro no banco:', err));

// ============================================
// ROTAS DA LOJA (PÚBLICAS)
// ============================================

app.get('/api/config', async (req, res) => {
    try {
        let config = await Config.findOne({ key: 'main' });
        if (!config) config = await Config.create({ key: 'main' });
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar configuração' });
    }
});

app.get('/api/produtos', async (req, res) => {
    try {
        const produtos = await Produto.find();
        // flattenMaps: true converte o campo precosModelos (Map do Mongoose)
        // para um objeto JS simples, necessário para o frontend acessar via produto.precosModelos[chave]
        const produtosFormatados = produtos.map(p => {
            const obj = p.toObject({ flattenMaps: true });
            obj.id = obj._id.toString();
            return obj;
        });
        res.json(produtosFormatados);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar produtos' });
    }
});

app.get('/api/ping', (req, res) => res.send('pong'));

// Rastrear Pedido (Público)
app.get('/api/pedidos/rastreio/:pedidoId', async (req, res) => {
    try {
        const pedido = await Pedido.findOne({ pedidoId: req.params.pedidoId });
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
        res.json({ status: pedido.status });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar pedido' });
    }
});

app.post('/api/pedidos', limiterPedidos, async (req, res) => {
    try {
        const { nome, telefone, formaPagamento, itens, valorTotal } = req.body;

        // Validação dos campos obrigatórios
        if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
            return res.status(400).json({ erro: 'Nome inválido.' });
        }
        if (!telefone || typeof telefone !== 'string') {
            return res.status(400).json({ erro: 'Telefone inválido.' });
        }
        if (!['PIX', 'DINHEIRO', 'CREDITO'].includes(formaPagamento)) {
            return res.status(400).json({ erro: 'Forma de pagamento inválida.' });
        }
        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ erro: 'O pedido deve conter ao menos um item.' });
        }
        if (typeof valorTotal !== 'number' || valorTotal <= 0) {
            return res.status(400).json({ erro: 'Valor total inválido.' });
        }

        // pedidoId gerado no backend com mais entropia (6 chars)
        const pedidoId = `G34-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        const novoPedido = new Pedido({
            pedidoId,
            nome: nome.trim(),
            telefone: telefone.trim(),
            formaPagamento,
            itens,
            valorTotal
        });

        const pedidoSalvo = await novoPedido.save();

        // Envia a mensagem do WhatsApp para o cliente em segundo plano
        enviarMensagemPedido(pedidoSalvo);

        res.status(201).json(pedidoSalvo);
    } catch (erro) {
        console.error('Erro ao salvar pedido:', erro);
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
app.post('/api/admin/login', limiterLogin, async (req, res) => {
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
        console.error('Erro no login do Google:', error);
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

        // Verifica se TODOS os itens do pedido são pronta entrega
        const todosProntaEntrega = pedido.itens.every(i => i.isProntaEntrega);

        // Se for tudo pronta entrega, já vai direto para aguardando retirada
        pedido.status = todosProntaEntrega ? 'Aguardando Entrega' : 'Em Produção';
        await pedido.save();

        // 1. Atualiza a Etiqueta no WhatsApp
        await atualizarEtiquetaPedido(pedido.telefone, pedido.status);

        // 2. Envia mensagem de agradecimento/confirmação pro cliente
        await enviarMensagemAprovacao(pedido.telefone);

        res.json(pedido);
    } catch (error) {
        console.error('Erro ao aprovar:', error);
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

        // Verifica se todos os itens estão prontos (itens de pronta entrega não precisam ser estampados)
        const todosProntos = pedido.itens.every(i => i.pronto || i.isProntaEntrega);
        if (todosProntos && pedido.status === 'Em Produção') {
            pedido.status = 'Aguardando Entrega';
            await atualizarEtiquetaPedido(pedido.telefone, 'Aguardando Entrega');
        } else if (!todosProntos && pedido.status === 'Aguardando Entrega') {
            pedido.status = 'Em Produção';
        }

        await pedido.save();
        res.json(pedido);
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
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
        console.error('Erro ao deletar:', error);
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
        console.error('Erro ao notificar pronto:', error);
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
        console.error('Erro ao marcar como entregue:', error);
        res.status(500).json({ erro: 'Erro ao marcar como entregue' });
    }
});

// ============================================
// GESTÃO DE PRODUTOS (ADMIN)
// ============================================

app.put('/api/admin/config', verifyToken, async (req, res) => {
    try {
        const payload = {
            heroTitulo: req.body.heroTitulo,
            heroSubtitulo: req.body.heroSubtitulo,
            heroBanner: req.body.heroBanner
        };
        const config = await Config.findOneAndUpdate(
            { key: 'main' },
            { $set: payload },
            { new: true, upsert: true }
        );
        res.json(config);
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({ erro: 'Erro ao atualizar configuração' });
    }
});

// Campos permitidos para evitar sobrescrita de campos internos via req.body
const CAMPOS_PRODUTO_PERMITIDOS = ['nome', 'desc', 'categoria', 'preco', 'cores', 'modelos', 'precosModelos', 'coresModelos', 'imagemCapa', 'tamanhos', 'estoqueLocal'];

app.post('/api/admin/produtos', verifyToken, async (req, res) => {
    try {
        const dados = {};
        CAMPOS_PRODUTO_PERMITIDOS.forEach(campo => {
            if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
        });
        const novoProduto = new Produto(dados);
        const salvo = await novoProduto.save();
        res.status(201).json(salvo);
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        res.status(500).json({ erro: 'Erro ao criar produto' });
    }
});

app.put('/api/admin/produtos/:id', verifyToken, async (req, res) => {
    try {
        const dados = {};
        CAMPOS_PRODUTO_PERMITIDOS.forEach(campo => {
            if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
        });
        const atualizado = await Produto.findByIdAndUpdate(
            req.params.id,
            { $set: dados },
            { new: true, runValidators: true }
        );
        if (!atualizado) return res.status(404).json({ erro: 'Produto não encontrado' });
        res.json(atualizado);
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ erro: 'Erro ao atualizar produto' });
    }
});

app.delete('/api/admin/produtos/:id', verifyToken, async (req, res) => {
    try {
        const produto = await Produto.findByIdAndDelete(req.params.id);
        if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
        res.json({ mensagem: 'Produto excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao excluir produto' });
    }
});

app.listen(3001, () => console.log('📡 API de Pedidos rodando na porta 3001'));