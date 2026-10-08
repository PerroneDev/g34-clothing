const mongoose = require('mongoose');

// Paleta base de cores do site: ao criar um anúncio basta escolher daqui
const corSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true, trim: true },
    hex: { type: String, required: true, trim: true }
});

module.exports = mongoose.model('Cor', corSchema);
