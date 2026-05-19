// whatsapp.js
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode-terminal');

let client;
let isReady = false;
let qrCodeData = '';

const inicializarWhatsApp = async (mongoose) => {
    console.log('🔄 Inicializando bot do WhatsApp com MongoDB...');
    const store = new MongoStore({ mongoose: mongoose });

    client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <-- A MÁGICA CONTRA O ERRO DE MEMÓRIA
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('📱 Novo QR Code gerado! Escaneie pelo Painel Admin ou pelo terminal abaixo:');
        qrcode.generate(qr, { small: true });
        qrCodeData = qr; // Salva o QR para enviar via API
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp conectado e pronto para enviar mensagens!');
        isReady = true;
        qrCodeData = '';
    });

    client.on('disconnected', (reason) => {
        console.log('❌ WhatsApp desconectado!', reason);
        isReady = false;
        qrCodeData = '';
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Sessão do WhatsApp salva no MongoDB com sucesso!');
    });

    client.initialize();
};

const getWhatsAppStatus = () => {
    return { isReady, qrCode: qrCodeData };
};

/**
 * Função para formatar o número do WhatsApp
 */
function formatarNumero(telefone) {
    let numeroLimpo = telefone.replace(/\D/g, '');
    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = '55' + numeroLimpo;
    }
    return `${numeroLimpo}@c.us`;
}

/**
 * Função para atualizar a etiqueta de um cliente
 */
async function atualizarEtiquetaPedido(telefone, novoStatus) {
    if (!isReady) return;

    try {
        const chatId = formatarNumero(telefone);
        const labels = await client.getLabels();

        let nomeEtiquetaDesejada = '';
        if (novoStatus === 'Aguardando Pagamento') {
            nomeEtiquetaDesejada = 'Aguardando Pagamento';
        } else if (novoStatus === 'Em Produção' || novoStatus === 'Finalizado' || novoStatus === 'Aguardando Entrega') {
            nomeEtiquetaDesejada = 'Pagamento Aprovado';
        } else if (novoStatus === 'Entregue') {
            nomeEtiquetaDesejada = 'Entregue';
        }

        if (!nomeEtiquetaDesejada) return;

        const etiqueta = labels.find(l => l.name.toLowerCase() === nomeEtiquetaDesejada.toLowerCase());

        if (etiqueta) {
            // O addOrRemoveLabels substitui as etiquetas do chat pelas informadas no array
            await client.addOrRemoveLabels([etiqueta.id], [chatId]);
            console.log(`🏷️ Etiqueta "${nomeEtiquetaDesejada}" aplicada para ${telefone}`);
        } else {
            console.log(`⚠️ Etiqueta "${nomeEtiquetaDesejada}" não encontrada no seu WhatsApp Business. Crie ela pelo celular!`);
        }
    } catch (error) {
        console.error(`❌ Erro ao atualizar etiqueta para ${telefone}:`, error.message);
    }
}

/**
 * Função para enviar a mensagem formatada de acordo com o pedido
 */
async function enviarMensagemPedido(pedido) {
    if (!isReady) {
        console.log('⚠️ WhatsApp ainda não está pronto para enviar mensagens.');
        return false;
    }

    try {
        const chatId = formatarNumero(pedido.telefone);

        let mensagem = `Olá, *${pedido.nome}*! 🙏\n\nRecebemos o seu pedido da coleção do Congresso!\n\n🔖 *Nº do Pedido:* ${pedido.pedidoId || 'G34-TESTE'}\n\n🛒 *Seus Itens:*\n`;

        pedido.itens.forEach(item => {
            const extra = item.isProntaEntrega ? ' 🔥(Pronta Entrega)' : '';
            mensagem += `- ${item.quantidade}x ${item.modelo} (${item.cor || item.tecido} | Tam: ${item.tamanho})${extra}\n`;
        });

        mensagem += `\n💰 *Valor Total: R$ ${pedido.valorTotal.toFixed(2).replace('.', ',')}*\n\n`;

        if (pedido.formaPagamento === 'PIX') {
            mensagem += `💳 *Pagamento via PIX*\n\n`;
            mensagem += `Nossa chave PIX é: *CHAVE-AQUI*\n`;
            mensagem += `Por favor, envie o *comprovante* respondendo a esta mensagem para confirmarmos seu pedido e liberarmos para a produção.\n\n`;
        } else if (pedido.formaPagamento === 'CREDITO') {
            mensagem += `💳 *Pagamento via Cartão de Crédito*\n\n`;
            mensagem += `Você optou pelo pagamento no Cartão de Crédito.\n\n`;
            mensagem += `Por favor, procure a *Liderança dos Jovens* no próximo culto para passarmos o cartão na maquininha.\n\n`;
            mensagem += `Lembrando que o pedido só será liberado para produção após o pagamento.\n\n`;
        } else {
            mensagem += `💵 *Pagamento em Dinheiro*\n\n`;
            mensagem += `Você optou pelo pagamento presencial em Dinheiro.\n\n`;
            mensagem += `Por favor, procure a *Liderança dos Jovens* no próximo culto para realizar o acerto financeiro.\n\n`;
            mensagem += `Lembrando que o pedido só será liberado para produção após o pagamento.\n\n`;
        }
        
        mensagem += `📍 *Acompanhe seu pedido:*\nVocê pode consultar o status do seu pedido a qualquer momento no nosso site, informando o código *${pedido.pedidoId || 'G34-TESTE'}*.\n\nDeus te abençoe!`;

        await client.sendMessage(chatId, mensagem);
        console.log(`💬 Mensagem automática enviada para ${pedido.telefone} com sucesso!`);

        // Aplica a etiqueta inicial
        await atualizarEtiquetaPedido(pedido.telefone, 'Aguardando Pagamento');

        return true;

    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${pedido.telefone}:`, error);
        return false;
    }
}

/**
 * Função para notificar aprovação de pagamento
 */
async function enviarMensagemAprovacao(telefone) {
    if (!isReady) return false;
    try {
        const chatId = formatarNumero(telefone);
        const mensagem = `✅ *Pagamento Confirmado!*\n\nPassando para avisar que recebemos o seu pagamento e o seu pedido já está *Em Produção*! 🚀\n\nAvisaremos por aqui quando as camisas estiverem prontas para retirada. Deus abençoe!`;
        await client.sendMessage(chatId, mensagem);
        console.log(`💬 Mensagem de APROVAÇÃO enviada para ${telefone}!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar aprovação para ${telefone}:`, error);
        return false;
    }
}

/**
 * Função para notificar que o pedido está pronto
 */
async function enviarMensagemPronto(telefone) {
    if (!isReady) return false;
    try {
        const chatId = formatarNumero(telefone);
        const mensagem = `👕 *Seu Pedido Está Pronto!*\n\nPassando para avisar que o seu pedido já está pronto para retirada! 🎉\n\nPor favor, procure a *Liderança dos Jovens* na igreja para buscar as suas camisas.\n\nDeus abençoe!`;
        await client.sendMessage(chatId, mensagem);
        console.log(`💬 Mensagem de PRONTO enviada para ${telefone}!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem de pronto para ${telefone}:`, error);
        return false;
    }
}

module.exports = { client, inicializarWhatsApp, getWhatsAppStatus, enviarMensagemPedido, atualizarEtiquetaPedido, enviarMensagemAprovacao, enviarMensagemPronto };
