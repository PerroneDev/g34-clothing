import { API_BASE } from '../api.js';

export const OPCOES_TAMANHOS = ['P', 'M', 'G', 'GG', 'XG', '2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos', '14 anos', '16 anos', 'Único'];
export const TAMANHOS_INFANTIS = ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos', '14 anos', '16 anos'];
export const MODELO_PADRAO = 'Padrão';

export const FORMAS_PAGAMENTO = [
  { id: 'PIX', label: 'PIX' },
  { id: 'DINHEIRO', label: 'Dinheiro' },
  { id: 'CREDITO', label: 'Cartão de crédito' }
];
export const rotuloForma = (id) => FORMAS_PAGAMENTO.find(f => f.id === id)?.label || id;

export const fmt = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

export const formatarData = (data) => new Date(data).toLocaleDateString('pt-BR');

// Compara textos ignorando acentos e maiúsculas (busca por nome)
export const normalizar = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const imagemSrc = (img) => {
  if (!img) return '';
  return img.startsWith('data:image') || img.startsWith('http') ? img : `/images/${img}`;
};

export const modelosDe = (produto) =>
  produto.modelos && produto.modelos.length > 0 ? produto.modelos : [MODELO_PADRAO];

export const precosDe = (produto, modelo) =>
  (produto.precosEfetivos && produto.precosEfetivos[modelo]) ||
  { avista: produto.preco || 0, parcelado: produto.precoParcelado || produto.preco || 0 };

// Cores que o modelo aceita (sem restrição cadastrada = todas as cores do anúncio)
export const coresParaModelo = (produto, modelo) => {
  const todas = (produto.cores || []).map(c => (typeof c === 'string' ? c : c.nome));
  const restritas = produto.coresModelos && produto.coresModelos[modelo];
  return restritas && restritas.length > 0 ? todas.filter(c => restritas.includes(c)) : todas;
};

export const tamanhosParaModelo = (produto, modelo) =>
  (produto.tamanhos || [])
    .filter(t => TAMANHOS_INFANTIS.includes(t) === (modelo === 'Infantil'))
    .sort((a, b) => OPCOES_TAMANHOS.indexOf(a) - OPCOES_TAMANHOS.indexOf(b));

/**
 * Cliente da API do admin. Devolve { ok, status, data } e nunca lança exceção.
 * Se o token expirar (401), chama onNaoAutorizado para deslogar.
 */
export const criarApi = (token, onNaoAutorizado) => async (path, { method = 'GET', body } = {}) => {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* resposta sem corpo */ }
    if (res.status === 401) onNaoAutorizado?.();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { erro: 'Erro de conexão com o servidor.' } };
  }
};
