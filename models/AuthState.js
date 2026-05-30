const mongoose = require('mongoose');

const authStateSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // we will use this as the key for Baileys auth
    value: { type: String, required: true } // JSON stringified value
});

module.exports = mongoose.model('AuthState', authStateSchema);
