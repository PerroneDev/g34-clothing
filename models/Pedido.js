const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    cor: { type: String, required: false },
    tecido: { type: String, required: false },
    tamanho: { type: String, required: true },
    quantidade: { type: Number, required: true, default: 1 },
    preco: { type: Number, required: true },
    pronto: { type: Boolean, default: false },
    isProntaEntrega: { type: Boolean, default: false }
}, { _id: true }); // _id: true para podermos dar "check" em itens específicos

const pedidoSchema = new mongoose.Schema({
    pedidoId: { type: String, required: false, unique: true, sparse: true }, // sparse: true aceita null sem conflito
    nome: { type: String, required: true },
    telefone: { type: String, required: true },
    itens: [itemSchema],
    valorTotal: { type: Number, required: true },
    formaPagamento: {
        type: String,
        required: true,
        enum: ['PIX', 'DINHEIRO', 'CREDITO']
    },
    status: {
        type: String,
        default: 'Aguardando Pagamento',
        enum: ['Aguardando Pagamento', 'Em Produção', 'Aguardando Entrega', 'Entregue']
    },
    dataPedido: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', pedidoSchema);