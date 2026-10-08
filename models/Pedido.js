const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    produtoId: { type: String, required: false }, // referência ao anúncio de origem (permite editar o pedido)
    modelo: { type: String, required: true },
    tipoModelo: { type: String, required: false },
    cor: { type: String, required: false },
    tecido: { type: String, required: false },
    tamanho: { type: String, required: true },
    quantidade: { type: Number, required: true, default: 1 },
    preco: { type: Number, required: true }, // preço unitário efetivamente cobrado (já conforme a forma de pagamento)
    precoAvista: { type: Number, required: false },
    precoParcelado: { type: Number, required: false },
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
    // Pagamento e produção são processos independentes e podem ser alterados em qualquer direção
    statusPagamento: {
        type: String,
        default: 'Pendente',
        enum: ['Pendente', 'Pago']
    },
    statusProducao: {
        type: String,
        default: 'Em Produção',
        enum: ['Em Produção', 'Pronta', 'Entregue']
    },
    pagoEm: { type: Date, default: null },
    // true quando o estoque de pronta entrega deste pedido já foi descontado (pedidos antigos ficam false)
    estoqueBaixado: { type: Boolean, default: false },
    dataPedido: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', pedidoSchema);
