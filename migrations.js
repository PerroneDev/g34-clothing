// migrations.js — ajustes de dados executados na inicialização. Todos são idempotentes.
const Pedido = require('./models/Pedido');
const Produto = require('./models/Produto');
const Cor = require('./models/Cor');

/**
 * O antigo campo único `status` vira dois campos independentes.
 * Usa o driver nativo porque `status` não existe mais no schema.
 * O valor antigo de `status` é mantido no documento como histórico.
 */
async function migrarStatusPedidos() {
    const semNovoStatus = { statusPagamento: { $exists: false } };
    const regras = [
        { status: 'Aguardando Pagamento', set: { statusPagamento: 'Pendente', statusProducao: 'Em Produção' } },
        { status: 'Em Produção', set: { statusPagamento: 'Pago', statusProducao: 'Em Produção' } },
        { status: 'Aguardando Entrega', set: { statusPagamento: 'Pago', statusProducao: 'Pronta' } },
        { status: 'Entregue', set: { statusPagamento: 'Pago', statusProducao: 'Entregue' } }
    ];

    let total = 0;
    for (const regra of regras) {
        const r = await Pedido.collection.updateMany(
            { ...semNovoStatus, status: regra.status },
            { $set: regra.set }
        );
        total += r.modifiedCount;
    }
    // Qualquer pedido sem status reconhecido entra como pendente
    const r = await Pedido.collection.updateMany(
        semNovoStatus,
        { $set: { statusPagamento: 'Pendente', statusProducao: 'Em Produção' } }
    );
    total += r.modifiedCount;

    if (total > 0) console.log(`🔧 Migração: ${total} pedido(s) convertidos para status de pagamento/produção.`);
}

/** Primeira execução: monta a paleta com as cores que já existem nos anúncios */
async function popularPaletaDeCores() {
    if (await Cor.countDocuments() > 0) return;

    const produtos = await Produto.find({}, 'cores');
    const vistas = new Map();
    produtos.forEach(p => (p.cores || []).forEach(c => {
        if (c && c.nome && !vistas.has(c.nome.toLowerCase())) vistas.set(c.nome.toLowerCase(), { nome: c.nome.trim(), hex: c.hex });
    }));
    if (vistas.size > 0) {
        await Cor.insertMany([...vistas.values()], { ordered: false }).catch(() => {});
        console.log(`🎨 Paleta de cores criada com ${vistas.size} cor(es) dos anúncios existentes.`);
    }
}

/** Atribui posição (ordem) aos anúncios que ainda não têm, preservando a ordem de criação */
async function numerarProdutos() {
    const produtos = await Produto.find({}, '_id ordem').sort({ _id: 1 });
    if (produtos.length === 0 || produtos.some(p => p.ordem > 0)) return;
    await Produto.bulkWrite(produtos.map((p, i) => ({
        updateOne: { filter: { _id: p._id }, update: { $set: { ordem: i + 1 } } }
    })));
}

async function rodarMigracoes() {
    try {
        await migrarStatusPedidos();
        await popularPaletaDeCores();
        await numerarProdutos();
    } catch (err) {
        console.error('Erro nas migrações:', err);
    }
}

module.exports = { rodarMigracoes };
