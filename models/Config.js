const mongoose = require('mongoose');

// Um único documento por site — identificado pela chave 'main'
const configSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'main' },
    heroTitulo:    { type: String, default: 'Coleção\nG34 2026' },
    heroSubtitulo: { type: String, default: 'Confira os modelos exclusivos.' },
    heroBanner:    { type: String, default: '' }, // base64 ou URL
    
    // Configurações do Guia de Medidas
    calcAtiva: { type: Boolean, default: false },
    tabelaMedidas: { 
        type: [{
            tam: String,
            altura: String,
            largura: String
        }], 
        default: [
            { tam: 'P', altura: '68cm', largura: '48cm' },
            { tam: 'M', altura: '70cm', largura: '52cm' },
            { tam: 'G', altura: '72cm', largura: '54cm' },
            { tam: 'GG', altura: '74cm', largura: '58cm' }
        ]
    }
});

module.exports = mongoose.model('Config', configSchema);
