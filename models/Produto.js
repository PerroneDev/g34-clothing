const mongoose = require('mongoose');

const estoqueLocalSchema = new mongoose.Schema({
    id: { type: String, required: true }, // ex: leao-preto-m
    cor: { type: String, required: true },
    tamanho: { type: String, required: true },
    qtd: { type: Number, required: true, default: 0 }
}, { _id: false });

const produtoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    desc: { type: String },
    categoria: { type: String, required: true },
    preco: { type: Number, required: false, default: 0 },
    cores: [{
        nome: { type: String, required: true },
        hex: { type: String, required: true }
    }],
    modelos: [{ type: String }],
    precosModelos: { type: Map, of: Number },
    coresModelos: { type: Map, of: [String] }, // Map de nome do modelo → lista de cores disponíveis
    imagemCapa: { type: String, default: '' },
    tamanhos: [{ type: String }],
    estoqueLocal: [estoqueLocalSchema]
});

module.exports = mongoose.model('Produto', produtoSchema);
