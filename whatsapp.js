// whatsapp.js
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, initAuthCreds } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const AuthState = require('./models/AuthState');

let client;
let isReady = false;
let qrCodeData = '';

// Custom MongoDB Auth State Adapter for Baileys
const useMongoDBAuthState = async (collection) => {
    const writeData = async (data, key) => {
        const json = JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
        await collection.findOneAndUpdate({ _id: key }, { value: json }, { upsert: true });
    };

    const readData = async (key) => {
        const doc = await collection.findById(key);
        if (doc) {
            return JSON.parse(doc.value, (k, v) => {
                if (v && v.type === 'Buffer' && Array.isArray(v.data)) {
                    return Buffer.from(v.data);
                }
                return v;
            });
        }
        return null;
    };

    const removeData = async (key) => {
        await collection.deleteOne({ _id: key });
    };

    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        }
    };
};

const inicializarWhatsApp = async () => {
    console.log('🔄 Inicializando bot do WhatsApp com Baileys e MongoDB...');

    const { state, saveCreds } = await useMongoDBAuthState(AuthState);
    const { version } = await fetchLatestBaileysVersion();

    const connectToWhatsApp = async () => {
        client = makeWASocket({
            version,
            logger: pino({ level: 'silent' }), // Silencia os logs enormes do Baileys
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            generateHighQualityLinkPreview: true
        });

        client.ev.on('creds.update', saveCreds);

        client.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📱 Novo QR Code gerado! Escaneie pelo Painel Admin ou pelo terminal abaixo:');
                qrcode.generate(qr, { small: true });
                qrCodeData = qr;
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ WhatsApp desconectado. Motivo:', lastDisconnect.error?.message, 'Reconectar?', shouldReconnect);
                isReady = false;
                qrCodeData = '';
                
                if (shouldReconnect) {
                    connectToWhatsApp();
                } else {
                    console.log('⚠️ Você foi deslogado. Delete os dados da coleção AuthState no MongoDB para escanear novo QR Code.');
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado via Baileys e pronto para enviar mensagens!');
                isReady = true;
                qrCodeData = '';
            }
        });
    };

    connectToWhatsApp();
};

const getWhatsAppStatus = () => {
    return { isReady, qrCode: qrCodeData };
};

/**
 * Função para formatar o número do WhatsApp (Baileys exige @s.whatsapp.net)
 */
function formatarNumero(telefone) {
    let numeroLimpo = telefone.replace(/\D/g, '');
    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = '55' + numeroLimpo;
    }
    return `${numeroLimpo}@s.whatsapp.net`;
}

/**
 * Função para atualizar a etiqueta de um cliente
 * AVISO: O uso nativo de etiquetas via Baileys é complexo e não recomendado aqui.
 * Foi desativado por aprovação para usar a integração leve.
 */
async function atualizarEtiquetaPedido(telefone, novoStatus) {
    // console.log(`⚠️ Atualização de Etiquetas no WhatsApp ignorada (Desativado pelo Baileys). Status alvo: ${novoStatus}`);
}

/**
 * Função para enviar a mensagem formatada de acordo com o pedido
 */
async function enviarMensagemPedido(pedido) {
    if (!isReady || !client) {
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

        await client.sendMessage(chatId, { text: mensagem });
        console.log(`💬 Mensagem automática enviada para ${pedido.telefone} com sucesso!`);

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
    if (!isReady || !client) return false;
    try {
        const chatId = formatarNumero(telefone);
        const mensagem = `✅ *Pagamento Confirmado!*\n\nPassando para avisar que recebemos o seu pagamento e o seu pedido já está *Em Produção*! 🚀\n\nAvisaremos por aqui quando as camisas estiverem prontas para retirada. Deus abençoe!`;
        await client.sendMessage(chatId, { text: mensagem });
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
    if (!isReady || !client) return false;
    try {
        const chatId = formatarNumero(telefone);
        const mensagem = `👕 *Seu Pedido Está Pronto!*\n\nPassando para avisar que o seu pedido já está pronto para retirada! 🎉\n\nPor favor, procure a *Liderança dos Jovens* na igreja para buscar as suas camisas.\n\nDeus abençoe!`;
        await client.sendMessage(chatId, { text: mensagem });
        console.log(`💬 Mensagem de PRONTO enviada para ${telefone}!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem de pronto para ${telefone}:`, error);
        return false;
    }
}

module.exports = { client, inicializarWhatsApp, getWhatsAppStatus, enviarMensagemPedido, atualizarEtiquetaPedido, enviarMensagemAprovacao, enviarMensagemPronto };
