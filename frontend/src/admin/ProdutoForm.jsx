import { useState } from 'react';
import { Trash2, Plus, Check } from 'lucide-react';
import { Modal, Interruptor } from './ui.jsx';
import { OPCOES_TAMANHOS, imagemSrc, fmt } from './helpers.js';

const FORMULARIO_VAZIO = {
  nome: '', desc: '', categoria: 'Camisas', imagemCapa: '',
  preco: '', precoParcelado: '',
  modoParcelado: 'manual', percentualParcelado: '',
  cores: [], modelos: [], precosModelos: {}, precosModelosParcelado: {}, coresModelos: {},
  tamanhos: [], vendasPausadas: false
};

const paraTexto = (v) => (v === undefined || v === null || v === 0 ? '' : String(v));

// Valor em reais com acréscimo percentual (prévia no modo "à vista + %")
const comAcrescimo = (valor, pct) => {
  const v = parseFloat(valor);
  const p = parseFloat(pct);
  if (!(v > 0) || !(p > 0)) return null;
  return Math.round(v * (1 + p / 100) * 100) / 100;
};

/**
 * Formulário único de anúncio (criar e editar). Apenas o nome é obrigatório.
 * `paleta`: cores cadastradas no site; `criarCor`: cadastra uma cor nova na paleta e devolve { nome, hex }.
 */
export default function ProdutoForm({ produto, paleta, criarCor, api, notify, onClose, onSalvo }) {
  const editando = !!produto;
  const [form, setForm] = useState(() => !produto ? FORMULARIO_VAZIO : {
    ...FORMULARIO_VAZIO,
    ...produto,
    preco: paraTexto(produto.modelos?.length ? '' : produto.preco),
    precoParcelado: paraTexto(produto.modelos?.length ? '' : produto.precoParcelado),
    percentualParcelado: paraTexto(produto.percentualParcelado),
    cores: (produto.cores || []).map(c => ({ ...c })),
    modelos: [...(produto.modelos || [])],
    tamanhos: [...(produto.tamanhos || [])],
    precosModelos: Object.fromEntries(Object.entries(produto.precosModelos || {}).map(([k, v]) => [k, String(v)])),
    precosModelosParcelado: Object.fromEntries(Object.entries(produto.precosModelosParcelado || {}).map(([k, v]) => [k, String(v)])),
    // Modelo sem restrição cadastrada aceita todas as cores: mostramos todas marcadas
    coresModelos: Object.fromEntries((produto.modelos || []).map(m => {
      const lista = (produto.coresModelos || {})[m];
      return [m, lista && lista.length > 0 ? [...lista] : (produto.cores || []).map(c => c.nome)];
    }))
  });
  const [novoModelo, setNovoModelo] = useState('');
  const [novaCor, setNovaCor] = useState({ nome: '', hex: '#000000' });
  const [salvando, setSalvando] = useState(false);

  const atualizar = (campos) => setForm(prev => ({ ...prev, ...campos }));
  const percentual = form.modoParcelado === 'percentual';
  const temModelos = form.modelos.length > 0;

  // ── Cores ──
  const corSelecionada = (nome) => form.cores.some(c => c.nome === nome);

  const alternarCor = (cor) => {
    setForm(prev => {
      if (prev.cores.some(c => c.nome === cor.nome)) {
        const coresModelos = Object.fromEntries(Object.entries(prev.coresModelos).map(([m, lista]) => [m, lista.filter(n => n !== cor.nome)]));
        return { ...prev, cores: prev.cores.filter(c => c.nome !== cor.nome), coresModelos };
      }
      // Cor nova no anúncio já fica disponível em todos os modelos (dá para desmarcar depois)
      const coresModelos = { ...prev.coresModelos };
      prev.modelos.forEach(m => { coresModelos[m] = [...(coresModelos[m] || []), cor.nome]; });
      return { ...prev, cores: [...prev.cores, { nome: cor.nome, hex: cor.hex }], coresModelos };
    });
  };

  const cadastrarNovaCor = async () => {
    if (!novaCor.nome.trim()) return notify('Dê um nome para a cor.', 'erro');
    const criada = await criarCor(novaCor.nome.trim(), novaCor.hex);
    if (criada) {
      alternarCor(criada);
      setNovaCor({ nome: '', hex: '#000000' });
    }
  };

  // Cores do anúncio que não estão na paleta (anúncios antigos): continuam visíveis e removíveis
  const foraDaPaleta = form.cores.filter(c => !paleta.some(p => p.nome === c.nome));

  // ── Modelos ──
  const adicionarModelo = () => {
    const nome = novoModelo.trim();
    if (!nome) return;
    if (form.modelos.includes(nome)) return notify('Este modelo já foi adicionado.', 'erro');
    setForm(prev => ({
      ...prev,
      modelos: [...prev.modelos, nome],
      // Modelo novo já nasce com todas as cores do anúncio marcadas
      coresModelos: { ...prev.coresModelos, [nome]: prev.cores.map(c => c.nome) }
    }));
    setNovoModelo('');
  };

  const removerModelo = (nome) => {
    setForm(prev => {
      const sem = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== nome));
      return {
        ...prev,
        modelos: prev.modelos.filter(m => m !== nome),
        precosModelos: sem(prev.precosModelos),
        precosModelosParcelado: sem(prev.precosModelosParcelado),
        coresModelos: sem(prev.coresModelos)
      };
    });
  };

  const definirPreco = (campo, modelo, valor) =>
    setForm(prev => ({ ...prev, [campo]: { ...prev[campo], [modelo]: valor } }));

  const alternarCorDoModelo = (modelo, nomeCor) => {
    setForm(prev => {
      const atual = prev.coresModelos[modelo] || [];
      const nova = atual.includes(nomeCor) ? atual.filter(c => c !== nomeCor) : [...atual, nomeCor];
      return { ...prev, coresModelos: { ...prev.coresModelos, [modelo]: nova } };
    });
  };

  const alternarTamanho = (tam) =>
    setForm(prev => ({
      ...prev,
      tamanhos: prev.tamanhos.includes(tam) ? prev.tamanhos.filter(t => t !== tam) : [...prev.tamanhos, tam]
    }));

  const escolherImagem = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onloadend = () => atualizar({ imagemCapa: leitor.result });
    leitor.readAsDataURL(arquivo);
  };

  const salvar = async () => {
    if (!form.nome.trim()) return notify('Preencha o nome do produto.', 'erro');
    setSalvando(true);
    const { id, _id, __v, precosEfetivos, aPartirDe, estoqueLocal, ordem, ...dados } = form; // eslint-disable-line no-unused-vars
    const r = await api(editando ? `/api/admin/produtos/${produto.id}` : '/api/admin/produtos', {
      method: editando ? 'PUT' : 'POST',
      body: dados
    });
    setSalvando(false);
    if (r.ok) {
      notify(editando ? 'Produto atualizado!' : 'Produto criado!');
      onSalvo();
    } else {
      notify(r.data?.erro || 'Erro ao salvar o produto.', 'erro');
    }
  };

  return (
    <Modal
      titulo={editando ? 'Editar produto' : 'Novo produto'}
      onClose={onClose}
      largura={760}
      rodape={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar produto'}</button>
        </>
      }
    >
      <p className="text-muted form-hint">Só o <strong>nome</strong> é obrigatório. Todo o resto pode ser preenchido depois.</p>

      <div className="form-grid">
        <div className="input-field">
          <label>Nome do produto *</label>
          <input type="text" value={form.nome} onChange={e => atualizar({ nome: e.target.value })} placeholder="Ex: Camisa Jovem" />
        </div>
        <div className="input-field">
          <label>Categoria <small>(opcional)</small></label>
          <select value={form.categoria} onChange={e => atualizar({ categoria: e.target.value })}>
            <option>Camisas</option>
            <option>Moletons</option>
          </select>
        </div>
        <div className="input-field span-2">
          <label>Descrição <small>(opcional)</small></label>
          <input type="text" value={form.desc} onChange={e => atualizar({ desc: e.target.value })} placeholder="Ex: 100% algodão" />
        </div>
        <div className="input-field span-2">
          <label>Imagem da capa <small>(opcional)</small></label>
          <div className="file-row">
            {form.imagemCapa && <img src={imagemSrc(form.imagemCapa)} alt="Prévia" className="thumb" />}
            <input type="file" accept="image/*" onChange={escolherImagem} />
          </div>
        </div>
      </div>

      {/* ── PREÇOS ── */}
      <section className="form-section-admin">
        <h3>Preços</h3>
        <div className="seg" role="group" aria-label="Como calcular o valor parcelado">
          <button type="button" className={`seg-btn ${!percentual ? 'active' : ''}`} onClick={() => atualizar({ modoParcelado: 'manual' })}>
            Digitar os dois valores
          </button>
          <button type="button" className={`seg-btn ${percentual ? 'active' : ''}`} onClick={() => atualizar({ modoParcelado: 'percentual' })}>
            À vista + % de acréscimo
          </button>
        </div>

        {percentual && (
          <div className="input-field inline-field">
            <label>Acréscimo do parcelado (cartão)</label>
            <div className="input-suffix">
              <input type="number" min="0" step="0.1" value={form.percentualParcelado} onChange={e => atualizar({ percentualParcelado: e.target.value })} placeholder="Ex: 10" />
              <span>%</span>
            </div>
          </div>
        )}

        {!temModelos ? (
          <div className="form-grid">
            <div className="input-field">
              <label>Valor à vista (PIX/dinheiro)</label>
              <input type="number" min="0" step="0.01" value={form.preco} onChange={e => atualizar({ preco: e.target.value })} placeholder="0,00" />
            </div>
            <div className="input-field">
              <label>Valor parcelado (cartão)</label>
              {percentual ? (
                <input type="text" readOnly value={comAcrescimo(form.preco, form.percentualParcelado) !== null ? fmt(comAcrescimo(form.preco, form.percentualParcelado)) : '—'} />
              ) : (
                <input type="number" min="0" step="0.01" value={form.precoParcelado} onChange={e => atualizar({ precoParcelado: e.target.value })} placeholder="Igual ao à vista" />
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted">Os valores de cada modelo ficam na lista de modelos abaixo.</p>
        )}
      </section>

      {/* ── CORES ── */}
      <section className="form-section-admin">
        <h3>Cores <small>(opcional)</small></h3>
        <p className="text-muted">Toque nas cores da paleta para usar neste produto.</p>
        <div className="chip-row">
          {paleta.map(cor => (
            <button
              key={cor._id}
              type="button"
              className={`color-chip ${corSelecionada(cor.nome) ? 'active' : ''}`}
              onClick={() => alternarCor(cor)}
            >
              <span className="dot" style={{ background: cor.hex }} />
              {cor.nome}
              {corSelecionada(cor.nome) && <Check size={13} />}
            </button>
          ))}
          {foraDaPaleta.map(cor => (
            <button key={cor.nome} type="button" className="color-chip active" title="Cor fora da paleta — toque para remover" onClick={() => alternarCor(cor)}>
              <span className="dot" style={{ background: cor.hex }} />{cor.nome}<Check size={13} />
            </button>
          ))}
          {paleta.length === 0 && foraDaPaleta.length === 0 && <span className="text-muted">A paleta está vazia. Cadastre a primeira cor abaixo.</span>}
        </div>
        <div className="new-color-row">
          <input type="text" value={novaCor.nome} onChange={e => setNovaCor({ ...novaCor, nome: e.target.value })} placeholder="Nova cor (ex: Verde)" />
          <input type="color" value={novaCor.hex} onChange={e => setNovaCor({ ...novaCor, hex: e.target.value })} aria-label="Tom da cor" />
          <button type="button" className="btn-ghost" onClick={cadastrarNovaCor}><Plus size={15} /> Cadastrar na paleta</button>
        </div>
      </section>

      {/* ── MODELOS ── */}
      <section className="form-section-admin">
        <h3>Modelos / variações <small>(opcional)</small></h3>
        <div className="new-color-row">
          <input
            type="text"
            value={novoModelo}
            onChange={e => setNovoModelo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarModelo(); } }}
            placeholder="Nome do modelo (ex: Padrão, Baby Look, Infantil…)"
          />
          <button type="button" className="btn-ghost" onClick={adicionarModelo}><Plus size={15} /> Adicionar</button>
        </div>

        <div className="model-list">
          {form.modelos.map(mod => {
            const acrescimo = comAcrescimo(form.precosModelos[mod], form.percentualParcelado);
            return (
              <div key={mod} className="model-card">
                <div className="model-head">
                  <strong>{mod}</strong>
                  <button type="button" className="icon-btn danger" title={`Remover ${mod}`} onClick={() => removerModelo(mod)}><Trash2 size={15} /></button>
                </div>
                <div className="form-grid">
                  <div className="input-field">
                    <label>À vista (R$)</label>
                    <input type="number" min="0" step="0.01" value={form.precosModelos[mod] || ''} onChange={e => definirPreco('precosModelos', mod, e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="input-field">
                    <label>Parcelado (R$)</label>
                    {percentual ? (
                      <input type="text" readOnly value={acrescimo !== null ? fmt(acrescimo) : '—'} />
                    ) : (
                      <input type="number" min="0" step="0.01" value={form.precosModelosParcelado[mod] || ''} onChange={e => definirPreco('precosModelosParcelado', mod, e.target.value)} placeholder="Igual ao à vista" />
                    )}
                  </div>
                </div>
                {form.cores.length > 0 && (
                  <div className="chip-row compact">
                    <span className="text-muted full-line">Cores disponíveis neste modelo:</span>
                    {form.cores.map(cor => {
                      const marcada = (form.coresModelos[mod] || []).includes(cor.nome);
                      return (
                        <button key={cor.nome} type="button" className={`color-chip small ${marcada ? 'active' : ''}`} onClick={() => alternarCorDoModelo(mod, cor.nome)}>
                          <span className="dot" style={{ background: cor.hex }} />{cor.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {!temModelos && <p className="text-muted">Sem modelos: o produto é vendido numa única versão, com os preços acima.</p>}
        </div>
      </section>

      {/* ── TAMANHOS ── */}
      <section className="form-section-admin">
        <h3>Tamanhos disponíveis <small>(opcional)</small></h3>
        <div className="chip-row">
          {OPCOES_TAMANHOS.map(tam => (
            <button key={tam} type="button" className={`size-chip ${form.tamanhos.includes(tam) ? 'active' : ''}`} onClick={() => alternarTamanho(tam)}>
              {tam}
            </button>
          ))}
        </div>
      </section>

      <Interruptor
        ligado={form.vendasPausadas}
        onChange={v => atualizar({ vendasPausadas: v })}
        rotulo="Pausar vendas deste produto"
        descricao="O produto continua visível na loja, mas não pode ser comprado."
      />
    </Modal>
  );
}
