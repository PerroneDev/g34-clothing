require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;

// Credenciais do Cloudinary ficam no .env (nunca no código)
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️ Variáveis CLOUDINARY_* ausentes no .env — upload de imagens não vai funcionar.');
}
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const Pedido = require('./models/Pedido');
const Produto = require('./models/Produto');
const Config = require('./models/Config');
const Cor = require('./models/Cor');
const { rodarMigracoes } = require('./migrations');
const {
    MODELO_PADRAO, arredondar, num, mapGet,
    precosDoModelo, modelosDoProduto, resumoPrecos, precoPorForma, nomeDoItem
} = require('./pricing');
const { inicializarWhatsApp, getWhatsAppStatus, desconectarWhatsApp, enviarMensagemPedido, atualizarEtiquetaPedido, enviarMensagemAprovacao, enviarMensagemPronto } = require('./whatsapp');

const app = express();

const FORMAS_PAGAMENTO = ['PIX', 'DINHEIRO', 'CREDITO'];
const STATUS_PAGAMENTO = ['Pendente', 'Pago'];
const STATUS_PRODUCAO = ['Em Produção', 'Pronta', 'Entregue'];

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
    .then(async () => {
        console.log('🍃 Conectado ao MongoDB - Sistema do Congresso');
        await rodarMigracoes();
        inicializarWhatsApp();
    })
    .catch(err => console.error('Erro no banco:', err));

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const ehObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Produto no formato que o front consome: mapas viram objetos, preços efetivos já calculados
function formatarProduto(doc) {
    const obj = doc.toObject({ flattenMaps: true });
    obj.id = obj._id.toString();
    const { porModelo, aPartirDe } = resumoPrecos(obj);
    obj.precosEfetivos = porModelo;
    obj.aPartirDe = aPartirDe;
    return obj;
}

async function carregarConfig() {
    let config = await Config.findOne({ key: 'main' });
    if (!config) config = await Config.create({ key: 'main' });
    return config;
}

/**
 * Valida os itens enviados e monta o pedido a partir do catálogo.
 * O preço NUNCA vem do navegador: é recalculado aqui conforme a forma de pagamento.
 *
 * Em edições, itens inalterados (mesmo anúncio e modelo) mantêm o preço da época da compra.
 */
async function montarItens(itensReq, formaPagamento, { anteriores = [], formaAnterior = null, ignorarPausa = false } = {}) {
    if (!Array.isArray(itensReq) || itensReq.length === 0) return { erro: 'O pedido deve conter ao menos um item.' };
    if (itensReq.length > 50) return { erro: 'Itens demais no pedido.' };

    const ids = [...new Set(itensReq.map(i => String(i?.produtoId)))];
    if (!ids.every(ehObjectId)) return { erro: 'Item inválido no pedido.' };

    const produtos = await Produto.find({ _id: { $in: ids } });
    const porId = new Map(produtos.map(p => [p._id.toString(), p]));
    const itens = [];

    for (const [posicao, req] of itensReq.entries()) {
        const produtoId = String(req.produtoId);
        const produto = porId.get(produtoId);
        if (!produto) return { erro: 'Um dos produtos do pedido não está mais disponível.' };
        if (!ignorarPausa && produto.vendasPausadas) {
            return { erro: `As vendas de "${produto.nome}" estão pausadas no momento.`, status: 403 };
        }

        const quantidade = parseInt(req.quantidade, 10);
        if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) return { erro: 'Quantidade inválida.' };

        const modelos = modelosDoProduto(produto);
        const semModelos = !(produto.modelos && produto.modelos.length > 0);
        const tipoModelo = semModelos ? MODELO_PADRAO : req.tipoModelo;
        if (!modelos.includes(tipoModelo)) return { erro: `Modelo inválido para "${produto.nome}".` };

        const isProntaEntrega = !!req.isProntaEntrega;
        let cor = (req.cor || '').toString().trim();
        let tamanho = (req.tamanho || '').toString().trim();

        if (isProntaEntrega) {
            const linha = produto.estoqueLocal.find(e => e.cor === cor && e.tamanho === tamanho);
            if (!linha) return { erro: `"${produto.nome}" (${cor} / ${tamanho}) não está disponível à pronta entrega.` };
        } else {
            if (produto.cores.length > 0) {
                const nomesCores = produto.cores.map(c => c.nome);
                if (!nomesCores.includes(cor)) return { erro: `Cor inválida para "${produto.nome}".` };
                const restritas = mapGet(produto.coresModelos, tipoModelo);
                if (restritas && restritas.length > 0 && !restritas.includes(cor)) {
                    return { erro: `A cor ${cor} não existe no modelo ${tipoModelo}.` };
                }
            } else {
                cor = '';
            }
            if (produto.tamanhos.length > 0) {
                if (!produto.tamanhos.includes(tamanho)) return { erro: `Tamanho inválido para "${produto.nome}".` };
            } else {
                tamanho = 'Único';
            }
        }

        const modeloNome = nomeDoItem(produto, tipoModelo);
        let precos = precosDoModelo(produto, tipoModelo);

        // Itens de pedidos muito antigos podem não ter _id gravado: nesse caso casa pela posição
        // (a checagem `mesmoAnuncio` abaixo garante que só vale se for o mesmo produto/modelo)
        const anterior = (req._id && anteriores.find(a => a._id.toString() === String(req._id))) || anteriores[posicao] || null;
        const mesmoAnuncio = anterior && (anterior.produtoId
            ? anterior.produtoId === produtoId && anterior.tipoModelo === tipoModelo
            : anterior.modelo === modeloNome);

        if (mesmoAnuncio) {
            // Mantém os valores da época da compra; pedidos antigos só têm o preço único cobrado
            const avista = anterior.precoAvista || (formaAnterior !== 'CREDITO' ? anterior.preco : 0);
            const parcelado = anterior.precoParcelado || (formaAnterior === 'CREDITO' ? anterior.preco : 0);
            precos = { avista: avista || precos.avista, parcelado: parcelado || precos.parcelado };
        }

        if (precos.avista <= 0) return { erro: `"${produto.nome}" ainda não tem preço definido.` };

        const mesmaVariacao = mesmoAnuncio && anterior.cor === cor && anterior.tamanho === tamanho
            && !!anterior.isProntaEntrega === isProntaEntrega;

        const item = {
            produtoId,
            modelo: modeloNome,
            tipoModelo,
            cor,
            tamanho,
            quantidade,
            precoAvista: precos.avista,
            precoParcelado: precos.parcelado,
            preco: precoPorForma(precos, formaPagamento),
            isProntaEntrega,
            pronto: mesmaVariacao ? !!anterior.pronto : false
        };
        if (mesmoAnuncio) item._id = anterior._id;
        itens.push(item);
    }

    const valorTotal = arredondar(itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0));
    return { itens, valorTotal };
}

// Quantidade de pronta entrega consumida por um conjunto de itens (agrupada por produto/cor/tamanho)
function consumoProntaEntrega(itens) {
    const mapa = new Map();
    (itens || []).filter(i => i.isProntaEntrega && i.produtoId).forEach(i => {
        const chave = `${i.produtoId}|${i.cor}|${i.tamanho}`;
        const atual = mapa.get(chave) || { produtoId: i.produtoId, cor: i.cor, tamanho: i.tamanho, qtd: 0 };
        atual.qtd += i.quantidade;
        mapa.set(chave, atual);
    });
    return mapa;
}

// Diferença de consumo: positivo = baixar estoque, negativo = devolver
function deltaEstoque(antes, depois) {
    const deltas = new Map();
    for (const [chave, v] of depois) deltas.set(chave, { ...v, delta: v.qtd });
    for (const [chave, v] of antes) {
        const atual = deltas.get(chave) || { produtoId: v.produtoId, cor: v.cor, tamanho: v.tamanho, delta: 0 };
        atual.delta -= v.qtd;
        deltas.set(chave, atual);
    }
    return deltas;
}

const filtroLinhaEstoque = (d, exigirSaldo) => ({
    _id: d.produtoId,
    estoqueLocal: {
        $elemMatch: {
            cor: d.cor,
            tamanho: d.tamanho,
            ...(exigirSaldo ? { qtd: { $gte: d.delta } } : {})
        }
    }
});

/**
 * Aplica as variações no estoque de forma atômica (cada baixa só ocorre se houver saldo).
 * Se alguma baixa falhar, desfaz as anteriores.
 */
async function ajustarEstoque(deltas) {
    const lista = [...deltas.values()].filter(d => d.delta !== 0).sort((a, b) => a.delta - b.delta);
    const aplicados = [];

    for (const d of lista) {
        const r = await Produto.updateOne(
            filtroLinhaEstoque(d, d.delta > 0),
            { $inc: { 'estoqueLocal.$.qtd': -d.delta } }
        );
        if (r.modifiedCount > 0) {
            aplicados.push(d);
        } else if (d.delta > 0) {
            for (const a of aplicados.reverse()) {
                await Produto.updateOne(filtroLinhaEstoque(a, false), { $inc: { 'estoqueLocal.$.qtd': a.delta } });
            }
            return { ok: false, erro: `Estoque de pronta entrega insuficiente (${d.cor} / ${d.tamanho}).` };
        }
        // devolução sem linha de estoque correspondente (linha removida): nada a fazer
    }
    return { ok: true };
}

// Itens de pedidos antigos não guardam produtoId: tenta descobrir pelo nome para permitir a edição
function resolverItensLegados(pedidoObj, produtos) {
    const indice = new Map();
    produtos.forEach(p => {
        const id = p._id.toString();
        if (p.modelos && p.modelos.length > 0) {
            p.modelos.forEach(m => indice.set(`${p.nome} (${m})`, { produtoId: id, tipoModelo: m }));
        } else {
            indice.set(p.nome, { produtoId: id, tipoModelo: MODELO_PADRAO });
        }
    });
    pedidoObj.itens = (pedidoObj.itens || []).map(item => {
        if (item.produtoId) return item;
        const achado = indice.get(item.modelo);
        return achado ? { ...item, ...achado } : item;
    });
    return pedidoObj;
}

// ============================================
// ROTAS DA LOJA (PÚBLICAS)
// ============================================

app.get('/api/config', async (req, res) => {
    try {
        res.json(await carregarConfig());
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar configuração' });
    }
});

app.get('/api/produtos', async (req, res) => {
    try {
        const produtos = await Produto.find().sort({ ordem: 1, _id: 1 });
        res.json(produtos.map(formatarProduto));
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
        res.json({ statusPagamento: pedido.statusPagamento, statusProducao: pedido.statusProducao });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar pedido' });
    }
});

app.post('/api/pedidos', limiterPedidos, async (req, res) => {
    try {
        const { nome, telefone, formaPagamento, itens } = req.body;

        // Validação dos campos obrigatórios
        if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
            return res.status(400).json({ erro: 'Nome inválido.' });
        }
        if (!telefone || typeof telefone !== 'string') {
            return res.status(400).json({ erro: 'Telefone inválido.' });
        }
        if (!FORMAS_PAGAMENTO.includes(formaPagamento)) {
            return res.status(400).json({ erro: 'Forma de pagamento inválida.' });
        }

        const config = await carregarConfig();
        if (config.vendasPausadas) {
            return res.status(403).json({ erro: config.msgVendasPausadas || 'As vendas estão pausadas no momento.' });
        }

        const montado = await montarItens(itens, formaPagamento);
        if (montado.erro) return res.status(montado.status || 400).json({ erro: montado.erro });

        const consumo = consumoProntaEntrega(montado.itens);
        const baixa = await ajustarEstoque(deltaEstoque(new Map(), consumo));
        if (!baixa.ok) return res.status(409).json({ erro: baixa.erro });

        // pedidoId gerado no backend com mais entropia (6 chars)
        const pedidoId = `G34-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const todosProntaEntrega = montado.itens.every(i => i.isProntaEntrega);

        let pedidoSalvo;
        try {
            pedidoSalvo = await new Pedido({
                pedidoId,
                nome: nome.trim(),
                telefone: telefone.trim(),
                formaPagamento,
                itens: montado.itens,
                valorTotal: montado.valorTotal,
                statusProducao: todosProntaEntrega ? 'Pronta' : 'Em Produção',
                estoqueBaixado: consumo.size > 0
            }).save();
        } catch (erroSalvar) {
            await ajustarEstoque(deltaEstoque(consumo, new Map())); // devolve o estoque se o pedido não foi gravado
            throw erroSalvar;
        }

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
// As pausas de venda só valem para a loja: nenhuma rota do admin é bloqueada por elas.
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
        const [pedidos, produtos] = await Promise.all([
            Pedido.find().sort({ dataPedido: -1 }),
            Produto.find({}, 'nome modelos')
        ]);
        res.json(pedidos.map(p => resolverItensLegados(p.toObject(), produtos)));
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar pedidos' });
    }
});

// Status do WhatsApp e QR Code
app.get('/api/whatsapp/status', verifyToken, (req, res) => {
    res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/reset', verifyToken, async (req, res) => {
    res.json({ message: 'Desconectando e limpando sessão. O servidor será reiniciado.' });
    // Damos um pequeno delay para a resposta chegar ao client
    setTimeout(() => {
        desconectarWhatsApp();
    }, 1000);
});

// Alterar status de pagamento e/ou produção — livre, em qualquer direção e de forma independente
app.put('/api/pedidos/:id/status', verifyToken, async (req, res) => {
    try {
        const { statusPagamento, statusProducao, notificar } = req.body;
        if (statusPagamento !== undefined && !STATUS_PAGAMENTO.includes(statusPagamento)) {
            return res.status(400).json({ erro: 'Status de pagamento inválido.' });
        }
        if (statusProducao !== undefined && !STATUS_PRODUCAO.includes(statusProducao)) {
            return res.status(400).json({ erro: 'Status de produção inválido.' });
        }

        const atual = await Pedido.findById(req.params.id, 'statusPagamento pagoEm');
        if (!atual) return res.status(404).json({ erro: 'Pedido não encontrado' });

        // Atualiza só os campos de status, sem revalidar o pedido inteiro:
        // pedidos muito antigos (com dados incompletos) continuam podendo mudar de status
        const campos = {};
        if (statusPagamento !== undefined) {
            campos.statusPagamento = statusPagamento;
            campos.pagoEm = statusPagamento === 'Pago' ? (atual.pagoEm || new Date()) : null;
        }
        const opcoes = { returnDocument: 'after' };
        if (statusProducao !== undefined) {
            campos.statusProducao = statusProducao;
            // A produção do pedido e as peças da aba Produção andam juntas: Pronta/Entregue marca todas
            // as peças sob encomenda como estampadas; voltar para Em Produção desmarca todas
            campos['itens.$[peca].pronto'] = statusProducao !== 'Em Produção';
            opcoes.arrayFilters = [{ 'peca.isProntaEntrega': { $ne: true } }];
        }

        let pedido;
        try {
            pedido = await Pedido.findByIdAndUpdate(req.params.id, { $set: campos }, opcoes);
        } catch (erroItens) {
            // Pedido antigo sem lista de itens: muda só o status
            if (statusProducao === undefined) throw erroItens;
            delete campos['itens.$[peca].pronto'];
            pedido = await Pedido.findByIdAndUpdate(req.params.id, { $set: campos }, { returnDocument: 'after' });
        }
        const pagamentoAnterior = atual.statusPagamento;

        if (statusProducao !== undefined) await atualizarEtiquetaPedido(pedido.telefone, pedido.statusProducao);

        // Só avisa o cliente quando o pagamento passa a Pago (e o admin não pediu silêncio)
        if (statusPagamento === 'Pago' && pagamentoAnterior !== 'Pago' && notificar !== false) {
            await enviarMensagemAprovacao(pedido.telefone);
        }

        res.json(pedido);
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        res.status(500).json({ erro: 'Erro ao alterar status do pedido' });
    }
});

// Editar pedido já realizado (anúncio, modelo, cor, tamanho, quantidade e forma de pagamento)
app.put('/api/pedidos/:id/editar', verifyToken, async (req, res) => {
    try {
        const pedido = await Pedido.findById(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

        const formaPagamento = req.body.formaPagamento || pedido.formaPagamento;
        if (!FORMAS_PAGAMENTO.includes(formaPagamento)) {
            return res.status(400).json({ erro: 'Forma de pagamento inválida.' });
        }

        const montado = await montarItens(req.body.itens, formaPagamento, {
            anteriores: pedido.itens,
            formaAnterior: pedido.formaPagamento,
            ignorarPausa: true
        });
        if (montado.erro) return res.status(montado.status || 400).json({ erro: montado.erro });

        // Pedidos antigos (estoque nunca descontado) não mexem no estoque
        if (pedido.estoqueBaixado) {
            const ajuste = await ajustarEstoque(deltaEstoque(
                consumoProntaEntrega(pedido.itens),
                consumoProntaEntrega(montado.itens)
            ));
            if (!ajuste.ok) return res.status(409).json({ erro: ajuste.erro });
        }

        pedido.formaPagamento = formaPagamento;
        pedido.itens = montado.itens;
        pedido.valorTotal = montado.valorTotal;
        await pedido.save();

        res.json(pedido);
    } catch (error) {
        console.error('Erro ao editar pedido:', error);
        res.status(500).json({ erro: 'Erro ao editar pedido' });
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
        if (todosProntos && pedido.statusProducao === 'Em Produção') {
            pedido.statusProducao = 'Pronta';
            await atualizarEtiquetaPedido(pedido.telefone, 'Pronta');
        } else if (!todosProntos && pedido.statusProducao === 'Pronta') {
            pedido.statusProducao = 'Em Produção';
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

        // Devolve a pronta entrega ao estoque, a menos que a peça já tenha sido entregue
        if (pedido.estoqueBaixado && pedido.statusProducao !== 'Entregue') {
            await ajustarEstoque(deltaEstoque(consumoProntaEntrega(pedido.itens), new Map()));
        }

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

// ============================================
// CONFIGURAÇÃO DO SITE (ADMIN)
// ============================================

const CAMPOS_CONFIG = [
    'heroTitulo', 'heroSubtitulo', 'calcAtiva', 'tabelaMedidas',
    'msgPix', 'msgCredito', 'msgDinheiro', 'msgAprovado', 'msgPronto',
    'vendasPausadas', 'msgVendasPausadas'
];

app.put('/api/admin/config', verifyToken, async (req, res) => {
    try {
        const payload = {};
        CAMPOS_CONFIG.forEach(campo => {
            if (req.body[campo] !== undefined) payload[campo] = req.body[campo];
        });

        if (req.body.heroBanner !== undefined) {
            let heroBannerUrl = req.body.heroBanner;
            if (heroBannerUrl && heroBannerUrl.startsWith('data:image')) {
                const uploadRes = await cloudinary.uploader.upload(heroBannerUrl, { folder: 'g34_clothing' });
                heroBannerUrl = uploadRes.secure_url;
            }
            payload.heroBanner = heroBannerUrl;
        }

        const config = await Config.findOneAndUpdate(
            { key: 'main' },
            { $set: payload },
            { returnDocument: 'after', upsert: true }
        );
        res.json(config);
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({ erro: 'Erro ao atualizar configuração' });
    }
});

// ============================================
// PALETA DE CORES (ADMIN)
// ============================================

const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;

app.get('/api/admin/cores', verifyToken, async (req, res) => {
    try {
        res.json(await Cor.find().sort({ nome: 1 }));
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar cores' });
    }
});

app.post('/api/admin/cores', verifyToken, async (req, res) => {
    try {
        const nome = (req.body.nome || '').toString().trim();
        const hex = (req.body.hex || '').toString().trim();
        if (!nome) return res.status(400).json({ erro: 'Informe o nome da cor.' });
        if (!HEX_VALIDO.test(hex)) return res.status(400).json({ erro: 'Código de cor inválido (use o formato #RRGGBB).' });

        if (await Cor.findOne({ nome: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) {
            return res.status(409).json({ erro: 'Já existe uma cor com esse nome.' });
        }
        res.status(201).json(await Cor.create({ nome, hex }));
    } catch (error) {
        console.error('Erro ao criar cor:', error);
        res.status(500).json({ erro: 'Erro ao criar cor' });
    }
});

// Alterar o tom de uma cor atualiza também os anúncios que já a usam
app.put('/api/admin/cores/:id', verifyToken, async (req, res) => {
    try {
        const hex = (req.body.hex || '').toString().trim();
        if (!HEX_VALIDO.test(hex)) return res.status(400).json({ erro: 'Código de cor inválido (use o formato #RRGGBB).' });

        const cor = await Cor.findByIdAndUpdate(req.params.id, { $set: { hex } }, { returnDocument: 'after' });
        if (!cor) return res.status(404).json({ erro: 'Cor não encontrada' });

        await Produto.updateMany(
            { 'cores.nome': cor.nome },
            { $set: { 'cores.$[c].hex': hex } },
            { arrayFilters: [{ 'c.nome': cor.nome }] }
        );
        res.json(cor);
    } catch (error) {
        console.error('Erro ao atualizar cor:', error);
        res.status(500).json({ erro: 'Erro ao atualizar cor' });
    }
});

// Remove só da paleta: anúncios que já usam a cor continuam com ela
app.delete('/api/admin/cores/:id', verifyToken, async (req, res) => {
    try {
        const cor = await Cor.findByIdAndDelete(req.params.id);
        if (!cor) return res.status(404).json({ erro: 'Cor não encontrada' });
        res.json({ mensagem: 'Cor removida da paleta' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao remover cor' });
    }
});

// ============================================
// GESTÃO DE PRODUTOS (ADMIN)
// ============================================

const CAMPOS_PRODUTO = [
    'nome', 'desc', 'categoria', 'preco', 'precoParcelado', 'cores', 'modelos',
    'precosModelos', 'precosModelosParcelado', 'modoParcelado', 'percentualParcelado',
    'coresModelos', 'imagemCapa', 'tamanhos', 'vendasPausadas'
];

const textoUnico = (lista) => [...new Set((Array.isArray(lista) ? lista : []).map(v => String(v ?? '').trim()).filter(Boolean))];

// Mantém apenas valores numéricos positivos, das chaves informadas
function filtrarPrecos(mapa, chaves) {
    const saida = {};
    chaves.forEach(k => {
        const v = num(mapGet(mapa, k));
        if (v > 0) saida[k] = v;
    });
    return saida;
}

/**
 * Recebe os campos enviados pelo admin, junta com o produto atual (se houver) e devolve
 * os campos a gravar, já com preços derivados e coerentes (menor preço, parcelado por %, etc.).
 * Apenas o nome é obrigatório; o restante é opcional.
 */
function prepararProduto(body, atual = {}) {
    const enviado = {};
    CAMPOS_PRODUTO.forEach(campo => { if (body[campo] !== undefined) enviado[campo] = body[campo]; });

    if (enviado.nome !== undefined) enviado.nome = String(enviado.nome || '').trim();
    if (enviado.desc !== undefined) enviado.desc = String(enviado.desc || '').trim();
    if (enviado.categoria !== undefined) enviado.categoria = String(enviado.categoria || '').trim() || 'Camisas';
    if (enviado.modelos !== undefined) enviado.modelos = textoUnico(enviado.modelos);
    if (enviado.tamanhos !== undefined) enviado.tamanhos = textoUnico(enviado.tamanhos);
    if (enviado.cores !== undefined) {
        const vistas = new Set();
        enviado.cores = (Array.isArray(enviado.cores) ? enviado.cores : [])
            .map(c => ({ nome: String(c?.nome || '').trim(), hex: String(c?.hex || '').trim() }))
            .filter(c => c.nome && c.hex && !vistas.has(c.nome.toLowerCase()) && vistas.add(c.nome.toLowerCase()));
    }
    if (enviado.modoParcelado !== undefined && !['manual', 'percentual'].includes(enviado.modoParcelado)) {
        enviado.modoParcelado = 'manual';
    }
    if (enviado.vendasPausadas !== undefined) enviado.vendasPausadas = !!enviado.vendasPausadas;

    const final = { ...atual, ...enviado };
    const modelos = final.modelos || [];
    const nomesCores = (final.cores || []).map(c => c.nome);

    // Restrição de cores por modelo: só modelos e cores que ainda existem
    const coresModelos = {};
    modelos.forEach(m => {
        const lista = mapGet(final.coresModelos, m);
        if (Array.isArray(lista)) coresModelos[m] = lista.filter(c => nomesCores.includes(c));
    });

    const precosModelos = filtrarPrecos(final.precosModelos, modelos);
    const percentual = final.modoParcelado === 'percentual' ? num(final.percentualParcelado) : 0;
    const comAcrescimo = (v) => arredondar(v * (1 + percentual / 100));

    const precosModelosParcelado = percentual > 0
        ? Object.fromEntries(Object.entries(precosModelos).map(([m, v]) => [m, comAcrescimo(v)]))
        : filtrarPrecos(final.precosModelosParcelado, modelos);

    const valoresAvista = Object.values(precosModelos);
    const preco = valoresAvista.length > 0 ? Math.min(...valoresAvista) : num(final.preco);
    const precoParcelado = percentual > 0 ? comAcrescimo(preco) : num(final.precoParcelado);

    return {
        ...enviado,
        coresModelos,
        precosModelos,
        precosModelosParcelado,
        preco,
        precoParcelado,
        percentualParcelado: num(final.percentualParcelado)
    };
}

async function enviarImagem(dados) {
    if (dados.imagemCapa && dados.imagemCapa.startsWith('data:image')) {
        const uploadRes = await cloudinary.uploader.upload(dados.imagemCapa, { folder: 'g34_clothing' });
        dados.imagemCapa = uploadRes.secure_url;
    }
}

app.post('/api/admin/produtos', verifyToken, async (req, res) => {
    try {
        const dados = prepararProduto(req.body);
        if (!dados.nome) return res.status(400).json({ erro: 'Informe o nome do produto.' });

        await enviarImagem(dados);

        const ultimo = await Produto.findOne().sort({ ordem: -1 }).select('ordem');
        dados.ordem = (ultimo?.ordem || 0) + 1; // novos anúncios entram no fim da fila

        const salvo = await new Produto(dados).save();
        res.status(201).json(formatarProduto(salvo));
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        res.status(500).json({ erro: 'Erro ao criar produto' });
    }
});

// Reordenar anúncios da home — precisa vir antes de /:id
app.put('/api/admin/produtos/ordem', verifyToken, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.every(ehObjectId)) return res.status(400).json({ erro: 'Lista de ordem inválida.' });

        await Produto.bulkWrite(ids.map((id, i) => ({
            updateOne: { filter: { _id: id }, update: { $set: { ordem: i + 1 } } }
        })));
        res.json({ mensagem: 'Ordem atualizada' });
    } catch (error) {
        console.error('Erro ao reordenar:', error);
        res.status(500).json({ erro: 'Erro ao salvar a ordem' });
    }
});

app.put('/api/admin/produtos/:id', verifyToken, async (req, res) => {
    try {
        const atual = await Produto.findById(req.params.id);
        if (!atual) return res.status(404).json({ erro: 'Produto não encontrado' });

        const dados = prepararProduto(req.body, atual.toObject({ flattenMaps: true }));
        if (dados.nome !== undefined && !dados.nome) return res.status(400).json({ erro: 'O nome do produto não pode ficar vazio.' });

        await enviarImagem(dados);

        // O estoque nunca é sobrescrito por aqui: tem rotas próprias (evita apagar baixas feitas por pedidos)
        const atualizado = await Produto.findByIdAndUpdate(
            req.params.id,
            { $set: dados },
            { returnDocument: 'after', runValidators: true }
        );
        res.json(formatarProduto(atualizado));
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

// ---- Estoque de pronta entrega ----

app.post('/api/admin/produtos/:id/estoque', verifyToken, async (req, res) => {
    try {
        const cor = String(req.body.cor || '').trim();
        const tamanho = String(req.body.tamanho || '').trim();
        const qtd = parseInt(req.body.qtd, 10);
        if (!cor || !tamanho) return res.status(400).json({ erro: 'Informe cor e tamanho.' });
        if (!Number.isInteger(qtd) || qtd <= 0) return res.status(400).json({ erro: 'Quantidade inválida.' });

        const produto = await Produto.findById(req.params.id);
        if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

        const existente = produto.estoqueLocal.find(
            e => e.cor.toLowerCase() === cor.toLowerCase() && e.tamanho.toLowerCase() === tamanho.toLowerCase()
        );

        if (existente) {
            await Produto.updateOne({ _id: produto._id, 'estoqueLocal.id': existente.id }, { $inc: { 'estoqueLocal.$.qtd': qtd } });
        } else {
            const id = `${produto._id}-${cor.toLowerCase()}-${tamanho.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
            await Produto.updateOne({ _id: produto._id }, { $push: { estoqueLocal: { id, cor, tamanho, qtd } } });
        }
        res.json(formatarProduto(await Produto.findById(produto._id)));
    } catch (error) {
        console.error('Erro ao adicionar estoque:', error);
        res.status(500).json({ erro: 'Erro ao adicionar estoque' });
    }
});

app.put('/api/admin/produtos/:id/estoque/:estoqueId', verifyToken, async (req, res) => {
    try {
        const qtd = parseInt(req.body.qtd, 10);
        if (!Number.isInteger(qtd) || qtd < 0) return res.status(400).json({ erro: 'Quantidade inválida.' });

        const r = await Produto.updateOne(
            { _id: req.params.id, 'estoqueLocal.id': req.params.estoqueId },
            { $set: { 'estoqueLocal.$.qtd': qtd } }
        );
        if (r.matchedCount === 0) return res.status(404).json({ erro: 'Item de estoque não encontrado' });
        res.json(formatarProduto(await Produto.findById(req.params.id)));
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar estoque' });
    }
});

app.delete('/api/admin/produtos/:id/estoque/:estoqueId', verifyToken, async (req, res) => {
    try {
        await Produto.updateOne({ _id: req.params.id }, { $pull: { estoqueLocal: { id: req.params.estoqueId } } });
        const produto = await Produto.findById(req.params.id);
        if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
        res.json(formatarProduto(produto));
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao remover estoque' });
    }
});

app.listen(process.env.PORT || 3001, () => console.log(`📡 API de Pedidos rodando na porta ${process.env.PORT || 3001}`));
