const mongoose = require('mongoose');

const estoqueLocalSchema = new mongoose.Schema({
    id: { type: String, required: true }, // ex: leao-preto-m
    cor: { type: String, required: true },
    tamanho: { type: String, required: true },
    qtd: { type: Number, required: true, default: 0 }
}, { _id: false });

const produtoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    desc: { type: String, default: '' },
    categoria: { type: String, default: 'Camisas' },
    preco: { type: Number, required: false, default: 0 }, // à vista: menor preço entre os modelos (ou preço base se não houver modelos)
    precoParcelado: { type: Number, required: false, default: 0 }, // parcelado base (usado quando não há preço por modelo)
    cores: [{
        nome: { type: String, required: true },
        hex: { type: String, required: true }
    }],
    modelos: [{ type: String }],
    precosModelos: { type: Map, of: Number }, // preço à vista por modelo
    precosModelosParcelado: { type: Map, of: Number }, // preço parcelado (cartão) por modelo
    modoParcelado: { type: String, enum: ['manual', 'percentual'], default: 'manual' },
    percentualParcelado: { type: Number, default: 0 }, // % de acréscimo sobre o à vista (modo "percentual")
    coresModelos: { type: Map, of: [String] }, // Map de nome do modelo → lista de cores disponíveis
    imagemCapa: { type: String, default: '' },
    tamanhos: [{ type: String }],
    estoqueLocal: [estoqueLocalSchema],
    vendasPausadas: { type: Boolean, default: false },
    ordem: { type: Number, default: 0 } // posição na home (menor aparece primeiro)
});

module.exports = mongoose.model('Produto', produtoSchema);
