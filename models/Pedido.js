const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    cor: { type: String, required: true },
    tamanho: { type: String, required: true },
    quantidade: { type: Number, required: true, default: 1 },
    preco: { type: Number, required: true },
    pronto: { type: Boolean, default: false },
    isProntaEntrega: { type: Boolean, default: false }
}, { _id: true }); // Mudei para _id: true para podermos dar "check" em itens específicos

const pedidoSchema = new mongoose.Schema({
    pedidoId: { type: String, required: true },
    nome: { type: String, required: true },
    telefone: { type: String, required: true },
    itens: [itemSchema], // Lista de camisas
    valorTotal: { type: Number, required: true },
    formaPagamento: { 
        type: String, 
        required: true, 
        enum: ['PIX', 'DINHEIRO', 'CREDITO'] 
    },
    status: { 
        type: String, 
        default: 'Aguardando Pagamento',
        enum: ['Aguardando Pagamento', 'Em Produção', 'Aguardando Entrega', 'Entregue', 'Finalizado'] 
    },
    dataPedido: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pedido', pedidoSchema);