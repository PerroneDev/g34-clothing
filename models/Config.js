const mongoose = require('mongoose');

// Um único documento por site — identificado pela chave 'main'
const configSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'main' },
    heroTitulo:    { type: String, default: 'Coleção\nG34 2026' },
    heroSubtitulo: { type: String, default: 'Confira os modelos exclusivos.' },
    heroBanner:    { type: String, default: '' } // base64 ou URL
});

module.exports = mongoose.model('Config', configSchema);
