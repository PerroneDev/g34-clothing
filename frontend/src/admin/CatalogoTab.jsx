import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, GripVertical, PauseCircle, PlayCircle, Check, Minus } from 'lucide-react';
import ProdutoForm from './ProdutoForm.jsx';
import { Vazio } from './ui.jsx';
import { fmt, imagemSrc, precosDe, modelosDe } from './helpers.js';

export default function CatalogoTab({ produtos, setProdutos, cores, api, notify, recarregarProdutos, recarregarCores }) {
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [arrastando, setArrastando] = useState(null);
  const [alcado, setAlcado] = useState(null); // só arrasta quando pegam pelo ícone ⠿ (não atrapalha campos do cartão)
  const [novaCor, setNovaCor] = useState({ nome: '', hex: '#3b82f6' });
  const [hexPendente, setHexPendente] = useState({}); // id da cor → novo tom ainda não salvo

  const trocarProduto = (atualizado) =>
    setProdutos(prev => prev.map(p => (p.id === atualizado.id ? atualizado : p)));

  // ── Paleta de cores ──
  const criarCor = async (nome, hex) => {
    const r = await api('/api/admin/cores', { method: 'POST', body: { nome, hex } });
    if (r.ok) {
      await recarregarCores();
      return r.data;
    }
    notify(r.data?.erro || 'Erro ao cadastrar a cor.', 'erro');
    return null;
  };

  const adicionarCorPaleta = async () => {
    if (!novaCor.nome.trim()) return notify('Dê um nome para a cor.', 'erro');
    if (await criarCor(novaCor.nome.trim(), novaCor.hex)) setNovaCor({ nome: '', hex: '#3b82f6' });
  };

  const salvarTomCor = async (cor) => {
    const r = await api(`/api/admin/cores/${cor._id}`, { method: 'PUT', body: { hex: hexPendente[cor._id] } });
    if (r.ok) {
      setHexPendente(({ [cor._id]: _, ...resto }) => resto); // eslint-disable-line no-unused-vars
      await Promise.all([recarregarCores(), recarregarProdutos()]);
      notify(`Tom de "${cor.nome}" atualizado nos produtos.`);
    } else {
      notify(r.data?.erro || 'Erro ao atualizar a cor.', 'erro');
    }
  };

  const removerCorPaleta = async (cor) => {
    if (!window.confirm(`Remover "${cor.nome}" da paleta?\n\nOs produtos que já usam essa cor continuam com ela.`)) return;
    const r = await api(`/api/admin/cores/${cor._id}`, { method: 'DELETE' });
    if (r.ok) recarregarCores(); else notify(r.data?.erro || 'Erro ao remover a cor.', 'erro');
  };

  // ── Ordem dos anúncios ──
  const salvarOrdem = async (lista) => {
    setProdutos(lista);
    const r = await api('/api/admin/produtos/ordem', { method: 'PUT', body: { ids: lista.map(p => p.id) } });
    if (!r.ok) {
      notify(r.data?.erro || 'Não foi possível salvar a ordem.', 'erro');
      recarregarProdutos();
    }
  };

  const mover = (de, para) => {
    if (para < 0 || para >= produtos.length || de === para) return;
    const lista = [...produtos];
    const [item] = lista.splice(de, 1);
    lista.splice(para, 0, item);
    salvarOrdem(lista);
  };

  // ── Produto ──
  const alternarPausa = async (produto) => {
    const r = await api(`/api/admin/produtos/${produto.id}`, { method: 'PUT', body: { vendasPausadas: !produto.vendasPausadas } });
    if (r.ok) {
      trocarProduto(r.data);
      notify(r.data.vendasPausadas ? `Vendas de "${produto.nome}" pausadas.` : `Vendas de "${produto.nome}" liberadas.`);
    } else {
      notify(r.data?.erro || 'Erro ao alterar o produto.', 'erro');
    }
  };

  const excluir = async (produto) => {
    if (!window.confirm(`Excluir "${produto.nome}" do catálogo?`)) return;
    const r = await api(`/api/admin/produtos/${produto.id}`, { method: 'DELETE' });
    if (r.ok) recarregarProdutos(); else notify(r.data?.erro || 'Erro ao excluir.', 'erro');
  };

  const fecharForm = () => { setFormAberto(false); setEditando(null); };

  return (
    <div className="tab-content">
      <div className="panel">
        <div className="panel-head">
          <h2>Anúncios <span className="count-chip">{produtos.length}</span></h2>
          <div className="panel-actions">
            <button className="btn-ghost" onClick={recarregarProdutos}>Atualizar</button>
            <button className="btn-primary compact" onClick={() => setFormAberto(true)}><Plus size={16} /> Novo produto</button>
          </div>
        </div>
        <p className="text-muted panel-note">
          A ordem desta lista é a ordem da página inicial. Arraste pelo ícone ⠿ ou use as setas.
        </p>

        {produtos.length === 0 ? (
          <Vazio>Nenhum produto cadastrado.</Vazio>
        ) : (
          <div className="product-admin-list">
            {produtos.map((p, idx) => {
              const modelos = modelosDe(p);
              const faixa = modelos.map(m => precosDe(p, m));
              const avistas = faixa.map(f => f.avista).filter(v => v > 0);
              const parcelados = faixa.map(f => f.parcelado).filter(v => v > 0);
              const min = (l) => (l.length ? Math.min(...l) : 0);
              return (
                <article
                  key={p.id}
                  className={`product-admin-card ${arrastando === idx ? 'dragging' : ''} ${p.vendasPausadas ? 'paused' : ''}`}
                  draggable={alcado === idx}
                  onDragStart={() => setArrastando(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (arrastando !== null) mover(arrastando, idx); setArrastando(null); setAlcado(null); }}
                  onDragEnd={() => { setArrastando(null); setAlcado(null); }}
                >
                  <div className="reorder">
                    <button className="icon-btn" title="Subir" onClick={() => mover(idx, idx - 1)} disabled={idx === 0}><ChevronUp size={16} /></button>
                    <span className="grip" title="Arraste para reordenar" onMouseDown={() => setAlcado(idx)} onMouseUp={() => setAlcado(null)}><GripVertical size={16} /></span>
                    <button className="icon-btn" title="Descer" onClick={() => mover(idx, idx + 1)} disabled={idx === produtos.length - 1}><ChevronDown size={16} /></button>
                  </div>

                  <div className="product-admin-thumb">
                    {p.imagemCapa ? <img src={imagemSrc(p.imagemCapa)} alt="" /> : <span>sem foto</span>}
                  </div>

                  <div className="product-admin-info">
                    <div className="product-admin-title">
                      <strong>{p.nome}</strong>
                      <span className="tag">{p.categoria}</span>
                      {p.vendasPausadas && <span className="tag warn">Vendas pausadas</span>}
                    </div>
                    {p.desc && <span className="text-muted">{p.desc}</span>}
                    <div className="price-pair">
                      {avistas.length > 0 ? (
                        <>
                          <span>{avistas.length > 1 ? 'a partir de ' : ''}<strong>{fmt(min(avistas))}</strong> à vista</span>
                          {min(parcelados) !== min(avistas) && <span><strong>{fmt(min(parcelados))}</strong> parcelado</span>}
                        </>
                      ) : <span className="text-warning">Sem preço definido</span>}
                    </div>
                    <div className="text-muted small">
                      {p.modelos?.length > 0 && <>Modelos: {p.modelos.join(', ')} · </>}
                      {p.cores?.length > 0 && <>Cores: {p.cores.map(c => c.nome).join(', ')} · </>}
                      {p.tamanhos?.length > 0 && <>Tam: {p.tamanhos.join(', ')}</>}
                    </div>

                    <EstoqueProduto produto={p} api={api} notify={notify} aoAtualizar={trocarProduto} />
                  </div>

                  <div className="product-admin-actions">
                    <button className={`icon-btn ${p.vendasPausadas ? 'ok' : ''}`} title={p.vendasPausadas ? 'Liberar vendas' : 'Pausar vendas'} onClick={() => alternarPausa(p)}>
                      {p.vendasPausadas ? <PlayCircle size={18} /> : <PauseCircle size={18} />}
                    </button>
                    <button className="icon-btn" title="Editar" onClick={() => setEditando(p)}><Pencil size={16} /></button>
                    <button className="icon-btn danger" title="Excluir" onClick={() => excluir(p)}><Trash2 size={16} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Paleta de cores <span className="count-chip">{cores.length}</span></h2></div>
        <p className="text-muted panel-note">Cadastre as cores uma vez e escolha-as em qualquer produto. Mudar o tom aqui atualiza os produtos que já usam a cor.</p>

        <div className="palette-grid">
          {cores.map(cor => {
            const hex = hexPendente[cor._id] ?? cor.hex;
            return (
              <div key={cor._id} className="palette-item">
                <input
                  type="color"
                  value={hex}
                  onChange={e => setHexPendente(prev => ({ ...prev, [cor._id]: e.target.value }))}
                  aria-label={`Tom de ${cor.nome}`}
                />
                <span className="palette-name">{cor.nome}</span>
                {hexPendente[cor._id] && hexPendente[cor._id] !== cor.hex && (
                  <button className="icon-btn ok" title="Salvar novo tom" onClick={() => salvarTomCor(cor)}><Check size={15} /></button>
                )}
                <button className="icon-btn danger" title="Remover da paleta" onClick={() => removerCorPaleta(cor)}><Trash2 size={14} /></button>
              </div>
            );
          })}
          {cores.length === 0 && <span className="text-muted">Nenhuma cor cadastrada ainda.</span>}
        </div>

        <div className="new-color-row">
          <input type="text" value={novaCor.nome} onChange={e => setNovaCor({ ...novaCor, nome: e.target.value })} placeholder="Nome da cor (ex: Verde Militar)" onKeyDown={e => e.key === 'Enter' && adicionarCorPaleta()} />
          <input type="color" value={novaCor.hex} onChange={e => setNovaCor({ ...novaCor, hex: e.target.value })} aria-label="Tom da nova cor" />
          <button className="btn-primary compact" onClick={adicionarCorPaleta}><Plus size={16} /> Adicionar</button>
        </div>
      </div>

      {(formAberto || editando) && (
        <ProdutoForm
          produto={editando}
          paleta={cores}
          criarCor={criarCor}
          api={api}
          notify={notify}
          onClose={fecharForm}
          onSalvo={() => { fecharForm(); recarregarProdutos(); }}
        />
      )}
    </div>
  );
}

/** Estoque de pronta entrega do produto: ajustar quantidades, remover e adicionar linhas */
function EstoqueProduto({ produto, api, notify, aoAtualizar }) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState({ cor: '', tamanho: '', qtd: '' });
  const linhas = produto.estoqueLocal || [];
  const total = linhas.reduce((acc, e) => acc + e.qtd, 0);

  const coresOpcoes = (produto.cores || []).map(c => c.nome);
  const tamanhosOpcoes = produto.tamanhos || [];

  const resposta = (r, erroPadrao) => {
    if (r.ok) aoAtualizar(r.data); else notify(r.data?.erro || erroPadrao, 'erro');
  };

  const ajustar = async (linha, delta) => {
    const qtd = Math.max(0, linha.qtd + delta);
    resposta(await api(`/api/admin/produtos/${produto.id}/estoque/${linha.id}`, { method: 'PUT', body: { qtd } }), 'Erro ao ajustar o estoque.');
  };

  const remover = async (linha) => {
    if (!window.confirm(`Remover ${linha.cor} / ${linha.tamanho} do estoque?`)) return;
    resposta(await api(`/api/admin/produtos/${produto.id}/estoque/${linha.id}`, { method: 'DELETE' }), 'Erro ao remover do estoque.');
  };

  const adicionar = async () => {
    if (!novo.cor.trim() || !novo.tamanho.trim() || !novo.qtd) return notify('Preencha cor, tamanho e quantidade.', 'erro');
    const r = await api(`/api/admin/produtos/${produto.id}/estoque`, { method: 'POST', body: novo });
    if (r.ok) { aoAtualizar(r.data); setNovo({ cor: '', tamanho: '', qtd: '' }); } else notify(r.data?.erro || 'Erro ao adicionar estoque.', 'erro');
  };

  return (
    <div className="stock-box">
      <button className="stock-toggle" onClick={() => setAberto(!aberto)}>
        🔥 Pronta entrega: <strong>{total} un.</strong> {aberto ? '▴' : '▾'}
      </button>
      {aberto && (
        <div className="stock-body">
          {linhas.length === 0 && <span className="text-muted">Sem estoque cadastrado.</span>}
          {linhas.map(l => (
            <div key={l.id} className="stock-row">
              <span>{l.cor} / {l.tamanho}</span>
              <div className="qty-stepper small">
                <button onClick={() => ajustar(l, -1)} disabled={l.qtd <= 0} aria-label="Diminuir"><Minus size={13} /></button>
                <span>{l.qtd}</span>
                <button onClick={() => ajustar(l, 1)} aria-label="Aumentar"><Plus size={13} /></button>
              </div>
              <button className="icon-btn danger" title="Remover" onClick={() => remover(l)}><Trash2 size={14} /></button>
            </div>
          ))}

          <div className="stock-add">
            {coresOpcoes.length > 0 ? (
              <select value={novo.cor} onChange={e => setNovo({ ...novo, cor: e.target.value })}>
                <option value="">Cor…</option>
                {coresOpcoes.map(c => <option key={c}>{c}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Cor" value={novo.cor} onChange={e => setNovo({ ...novo, cor: e.target.value })} />
            )}
            {tamanhosOpcoes.length > 0 ? (
              <select value={novo.tamanho} onChange={e => setNovo({ ...novo, tamanho: e.target.value })}>
                <option value="">Tam…</option>
                {tamanhosOpcoes.map(t => <option key={t}>{t}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Tamanho" value={novo.tamanho} onChange={e => setNovo({ ...novo, tamanho: e.target.value })} />
            )}
            <input type="number" min="1" placeholder="Qtd" value={novo.qtd} onChange={e => setNovo({ ...novo, qtd: e.target.value })} />
            <button className="btn-ghost" onClick={adicionar}><Plus size={14} /> Estoque</button>
          </div>
        </div>
      )}
    </div>
  );
}
