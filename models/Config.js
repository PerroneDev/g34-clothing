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
    },
    
    // Templates de WhatsApp
    msgPix: { type: String, default: '💳 *Pagamento via PIX*\n\nNossa chave PIX é: *jovensg34@gmail.com*\nPor favor, envie o *comprovante* respondendo a esta mensagem para confirmarmos seu pedido e liberarmos para a produção.\n\n' },
    msgCredito: { type: String, default: '💳 *Pagamento via Cartão de Crédito*\n\nVocê optou pelo pagamento no Cartão de Crédito.\n\nPor favor, procure Vitória Perrone, Elias Nogueira ou alguém da Liderança dos Jovens no próximo culto para passarmos o cartão na maquininha.\n\nLembrando que o pedido só será liberado para produção após o pagamento.\n\n' },
    msgDinheiro: { type: String, default: '💵 *Pagamento em Dinheiro*\n\nVocê optou pelo pagamento presencial em Dinheiro.\n\nPor favor, procure Vitória Perrone, Elias Nogueira ou alguém da Liderança dos Jovens no próximo culto para realizar o acerto financeiro.\n\nLembrando que o pedido só será liberado para produção após o pagamento.\n\n' },
    msgAprovado: { type: String, default: '✅ *Pagamento Confirmado!*\n\nPassando para avisar que recebemos o seu pagamento e o seu pedido já está *Em Produção*! 🚀\n\nAvisaremos por aqui quando as camisas estiverem prontas para retirada. Deus abençoe!' },
    msgPronto: { type: String, default: '👕 *Seu Pedido Está Pronto!*\n\nPassando para avisar que o seu pedido já está pronto para retirada! 🎉\n\nPor favor, procure Vitória Perrone, Elias Nogueira ou alguém da Liderança dos Jovens na igreja para buscar as suas camisas.\n\nDeus abençoe!' }
});

module.exports = mongoose.model('Config', configSchema);
