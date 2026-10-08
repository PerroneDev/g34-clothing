// pricing.js — regras de preço (à vista x parcelado) usadas pelo servidor.
// Toda cobrança é calculada aqui, a partir do catálogo. O valor enviado pelo navegador é ignorado.

const MODELO_PADRAO = 'Padrão';

const arredondar = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Converte para número positivo; qualquer coisa inválida vira 0
const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

// Lê de um Map do Mongoose ou de um objeto simples
const mapGet = (m, chave) => {
    if (!m || chave == null) return undefined;
    return typeof m.get === 'function' ? m.get(chave) : m[chave];
};

/**
 * Preços efetivos de um modelo do produto.
 * - avista: preço do modelo; se não houver, o preço base do produto.
 * - parcelado: no modo "percentual", à vista + acréscimo; no modo "manual", o valor digitado
 *   (cai no à vista se não houver valor parcelado).
 */
function precosDoModelo(produto, tipoModelo) {
    const precoModelo = num(mapGet(produto.precosModelos, tipoModelo));
    const avista = precoModelo || num(produto.preco);

    let parcelado = 0;
    if (produto.modoParcelado === 'percentual' && num(produto.percentualParcelado) > 0) {
        parcelado = arredondar(avista * (1 + num(produto.percentualParcelado) / 100));
    } else {
        parcelado = num(mapGet(produto.precosModelosParcelado, tipoModelo))
            || (precoModelo ? 0 : num(produto.precoParcelado));
    }

    return { avista, parcelado: parcelado || avista };
}

/** Lista de modelos de venda do produto ('Padrão' implícito quando não há modelos) */
function modelosDoProduto(produto) {
    return produto.modelos && produto.modelos.length > 0 ? produto.modelos : [MODELO_PADRAO];
}

/** Resumo enviado ao front: preços por modelo e menor preço à vista */
function resumoPrecos(produto) {
    const porModelo = {};
    modelosDoProduto(produto).forEach(m => { porModelo[m] = precosDoModelo(produto, m); });
    const avistas = Object.values(porModelo).map(p => p.avista).filter(v => v > 0);
    return { porModelo, aPartirDe: avistas.length ? Math.min(...avistas) : 0 };
}

/** Preço unitário que será cobrado conforme a forma de pagamento */
function precoPorForma(precos, formaPagamento) {
    return formaPagamento === 'CREDITO' ? precos.parcelado : precos.avista;
}

/** Nome exibido do item: "Camisa (Baby Look)"; sem modelos cadastrados, só o nome */
function nomeDoItem(produto, tipoModelo) {
    return produto.modelos && produto.modelos.length > 0
        ? `${produto.nome} (${tipoModelo})`
        : produto.nome;
}

module.exports = {
    MODELO_PADRAO, arredondar, num, mapGet,
    precosDoModelo, modelosDoProduto, resumoPrecos, precoPorForma, nomeDoItem
};
