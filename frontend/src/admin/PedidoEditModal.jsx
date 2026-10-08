import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui.jsx';
import {
  FORMAS_PAGAMENTO, fmt, modelosDe, precosDe, coresParaModelo, tamanhosParaModelo, MODELO_PADRAO
} from './helpers.js';

// Opções de pronta entrega saem das linhas de estoque do anúncio
const opcoesEstoque = (produto) => produto.estoqueLocal || [];

export default function PedidoEditModal({ pedido, produtos, api, notify, onClose, onSalvo }) {
  const [forma, setForma] = useState(pedido.formaPagamento);
  const [itens, setItens] = useState(() => pedido.itens.map(i => ({
    _id: i._id,
    produtoId: i.produtoId || '',
    tipoModelo: i.tipoModelo || MODELO_PADRAO,
    cor: i.cor || i.tecido || '',
    tamanho: i.tamanho,
    quantidade: i.quantidade,
    isProntaEntrega: !!i.isProntaEntrega,
    original: i
  })));
  const [salvando, setSalvando] = useState(false);

  const produtoDe = (id) => produtos.find(p => p.id === id);

  const atualizarItem = (idx, mudancas) =>
    setItens(prev => prev.map((it, i) => (i === idx ? { ...it, ...mudancas } : it)));

  // Ao trocar de anúncio/modelo, escolhe a primeira cor e tamanho válidos
  const ajustarVariacao = (item, produto, tipoModelo) => {
    if (item.isProntaEntrega) {
      const linha = opcoesEstoque(produto)[0];
      return { tipoModelo, cor: linha?.cor || '', tamanho: linha?.tamanho || '' };
    }
    const cores = coresParaModelo(produto, tipoModelo);
    const tamanhos = (produto.tamanhos || []).length > 0 ? tamanhosParaModelo(produto, tipoModelo) : [];
    return {
      tipoModelo,
      cor: cores.includes(item.cor) ? item.cor : (cores[0] || ''),
      tamanho: tamanhos.includes(item.tamanho) ? item.tamanho : (tamanhos[0] || 'Único')
    };
  };

  const trocarProduto = (idx, produtoId) => {
    const produto = produtoDe(produtoId);
    if (!produto) return;
    const item = itens[idx];
    atualizarItem(idx, { produtoId, ...ajustarVariacao(item, produto, modelosDe(produto)[0]) });
  };

  const adicionarItem = () => {
    const produto = produtos[0];
    if (!produto) return;
    const base = { isProntaEntrega: false, cor: '', tamanho: '' };
    setItens(prev => [...prev, {
      produtoId: produto.id, quantidade: 1, isProntaEntrega: false, original: null,
      ...ajustarVariacao(base, produto, modelosDe(produto)[0])
    }]);
  };

  // Prévia do valor: itens inalterados mantêm o preço da época; os demais usam o catálogo atual.
  // O servidor refaz esse cálculo ao salvar.
  const precoUnitario = (item) => {
    const original = item.original;
    const produto = produtoDe(item.produtoId);
    const catalogo = produto ? precosDe(produto, item.tipoModelo) : { avista: 0, parcelado: 0 };

    // O servidor já devolve produtoId/tipoModelo também para pedidos antigos (quando consegue identificar)
    const preservado = original && original.produtoId === item.produtoId && original.tipoModelo === item.tipoModelo;
    if (preservado) {
      const avista = original.precoAvista || (pedido.formaPagamento !== 'CREDITO' ? original.preco : 0) || catalogo.avista;
      const parcelado = original.precoParcelado || (pedido.formaPagamento === 'CREDITO' ? original.preco : 0) || catalogo.parcelado;
      return forma === 'CREDITO' ? parcelado : avista;
    }
    return forma === 'CREDITO' ? catalogo.parcelado : catalogo.avista;
  };

  const novoTotal = useMemo(
    () => itens.reduce((acc, it) => acc + precoUnitario(it) * (parseInt(it.quantidade, 10) || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itens, forma, produtos]
  );

  const salvar = async () => {
    if (itens.length === 0) return notify('O pedido precisa ter ao menos um item.', 'erro');
    if (itens.some(i => !i.produtoId)) return notify('Há itens sem produto definido. Escolha o produto de cada um.', 'erro');
    setSalvando(true);
    const r = await api(`/api/pedidos/${pedido._id}/editar`, {
      method: 'PUT',
      body: {
        formaPagamento: forma,
        itens: itens.map(i => ({
          _id: i._id, produtoId: i.produtoId, tipoModelo: i.tipoModelo, cor: i.cor, tamanho: i.tamanho,
          quantidade: parseInt(i.quantidade, 10), isProntaEntrega: i.isProntaEntrega
        }))
      }
    });
    setSalvando(false);
    if (r.ok) {
      notify(`Pedido atualizado. Novo valor: ${fmt(r.data.valorTotal)}`);
      onSalvo();
    } else {
      notify(r.data?.erro || 'Erro ao salvar o pedido.', 'erro');
    }
  };

  const mudou = Math.abs(novoTotal - pedido.valorTotal) > 0.004;

  return (
    <Modal
      titulo={`Editar pedido · ${pedido.nome}`}
      onClose={onClose}
      largura={720}
      rodape={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
        </>
      }
    >
      <div className="input-field">
        <label>Forma de pagamento</label>
        <select value={forma} onChange={e => setForma(e.target.value)}>
          {FORMAS_PAGAMENTO.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      <div className="edit-items">
        {itens.map((item, idx) => {
          const produto = produtoDe(item.produtoId);
          const modelos = produto ? modelosDe(produto) : [];
          const semModelos = produto && !(produto.modelos && produto.modelos.length > 0);
          const cores = produto && !item.isProntaEntrega ? coresParaModelo(produto, item.tipoModelo) : [];
          const tamanhos = produto && !item.isProntaEntrega && (produto.tamanhos || []).length > 0
            ? tamanhosParaModelo(produto, item.tipoModelo) : [];
          const estoque = produto && item.isProntaEntrega ? opcoesEstoque(produto) : [];
          const chaveEstoque = `${item.cor}|${item.tamanho}`;

          return (
            <div key={item._id || `novo-${idx}`} className="edit-item">
              <div className="edit-item-head">
                <strong>Item {idx + 1}{item.isProntaEntrega ? ' 🔥 pronta entrega' : ''}</strong>
                <button className="icon-btn danger" title="Remover item" onClick={() => setItens(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="form-grid">
                <div className="input-field">
                  <label>Produto (arte)</label>
                  <select value={item.produtoId} onChange={e => trocarProduto(idx, e.target.value)}>
                    {!produto && <option value="">{item.original?.modelo || 'Produto não encontrado'} (escolha o produto)</option>}
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>

                {produto && !semModelos && (
                  <div className="input-field">
                    <label>Modelo</label>
                    <select value={item.tipoModelo} onChange={e => atualizarItem(idx, ajustarVariacao(item, produto, e.target.value))}>
                      {modelos.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                )}

                {item.isProntaEntrega ? (
                  produto && (
                    <div className="input-field span-2">
                      <label>Cor / tamanho em estoque</label>
                      <select
                        value={chaveEstoque}
                        onChange={e => { const [cor, tamanho] = e.target.value.split('|'); atualizarItem(idx, { cor, tamanho }); }}
                      >
                        {!estoque.some(e => `${e.cor}|${e.tamanho}` === chaveEstoque) && <option value={chaveEstoque}>{item.cor} / {item.tamanho}</option>}
                        {estoque.map(e => <option key={e.id} value={`${e.cor}|${e.tamanho}`}>{e.cor} / {e.tamanho} ({e.qtd} un.)</option>)}
                      </select>
                    </div>
                  )
                ) : (
                  <>
                    {cores.length > 0 && (
                      <div className="input-field">
                        <label>Cor</label>
                        <select value={item.cor} onChange={e => atualizarItem(idx, { cor: e.target.value })}>
                          {!cores.includes(item.cor) && <option value={item.cor}>{item.cor || 'Escolha…'}</option>}
                          {cores.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                    {tamanhos.length > 0 && (
                      <div className="input-field">
                        <label>Tamanho</label>
                        <select value={item.tamanho} onChange={e => atualizarItem(idx, { tamanho: e.target.value })}>
                          {!tamanhos.includes(item.tamanho) && <option value={item.tamanho}>{item.tamanho}</option>}
                          {tamanhos.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className="input-field">
                  <label>Quantidade</label>
                  <input type="number" min="1" value={item.quantidade} onChange={e => atualizarItem(idx, { quantidade: e.target.value })} />
                </div>
                <div className="input-field">
                  <label>Valor unitário ({forma === 'CREDITO' ? 'parcelado' : 'à vista'})</label>
                  <input type="text" readOnly value={fmt(precoUnitario(item))} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn-ghost" onClick={adicionarItem} disabled={produtos.length === 0}><Plus size={16} /> Adicionar item</button>

      <div className="summary-box admin">
        <div className="summary-row"><span>Valor anterior</span><strong>{fmt(pedido.valorTotal)}</strong></div>
        <div className={`summary-row total ${mudou ? 'changed' : ''}`}><span>Novo valor ({forma === 'CREDITO' ? 'parcelado' : 'à vista'})</span><strong>{fmt(novoTotal)}</strong></div>
        {mudou && <small className="text-muted">O valor foi recalculado automaticamente.</small>}
      </div>
    </Modal>
  );
}
