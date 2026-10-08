import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Interruptor } from './ui.jsx';

const MENSAGENS = [
  { campo: 'msgPix', titulo: 'Instruções para pagamento PIX' },
  { campo: 'msgCredito', titulo: 'Instruções para Cartão de Crédito' },
  { campo: 'msgDinheiro', titulo: 'Instruções para pagamento em dinheiro' },
  { campo: 'msgAprovado', titulo: 'Confirmação de pagamento ("Pago")' },
  { campo: 'msgPronto', titulo: 'Pedido pronto ("Avisar")' }
];

export default function SiteTab({ siteConfig, setSiteConfig, api, notify, alternarLoja }) {
  const [salvando, setSalvando] = useState(false);
  const atualizar = (campos) => setSiteConfig(prev => ({ ...prev, ...campos }));

  const mudarMedida = (index, campo, valor) =>
    atualizar({ tabelaMedidas: siteConfig.tabelaMedidas.map((m, i) => (i === index ? { ...m, [campo]: valor } : m)) });

  const escolherBanner = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onloadend = () => atualizar({ heroBanner: leitor.result });
    leitor.readAsDataURL(arquivo);
  };

  const salvar = async () => {
    setSalvando(true);
    const r = await api('/api/admin/config', { method: 'PUT', body: siteConfig });
    setSalvando(false);
    if (r.ok) {
      setSiteConfig(r.data);
      notify('Configurações salvas!');
    } else {
      notify(r.data?.erro || 'Erro ao salvar configurações.', 'erro');
    }
  };

  return (
    <div className="tab-content narrow">
      <div className="panel">
        <div className="panel-head"><h2>Vendas</h2></div>
        <Interruptor
          ligado={siteConfig.vendasPausadas}
          onChange={alternarLoja}
          rotulo="Pausar as vendas da loja inteira"
          descricao="Os clientes continuam vendo os produtos, mas ninguém consegue comprar. O painel admin não é afetado."
        />
        <div className="input-field" style={{ marginTop: '1rem' }}>
          <label>Aviso exibido aos clientes quando as vendas estão pausadas</label>
          <input type="text" value={siteConfig.msgVendasPausadas || ''} onChange={e => atualizar({ msgVendasPausadas: e.target.value })} placeholder="Ex: Voltamos em breve com a reposição do estoque!" />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Tela inicial</h2></div>
        <div className="input-field">
          <label>Título (Enter pula linha)</label>
          <textarea rows="2" value={siteConfig.heroTitulo || ''} onChange={e => atualizar({ heroTitulo: e.target.value })} placeholder="Ex: Coleção&#10;G34 2026" />
        </div>
        <div className="input-field">
          <label>Subtítulo</label>
          <input type="text" value={siteConfig.heroSubtitulo || ''} onChange={e => atualizar({ heroSubtitulo: e.target.value })} placeholder="Ex: Confira os modelos exclusivos." />
        </div>
        <div className="input-field">
          <label>Imagem de capa (banner)</label>
          <div className="file-row">
            {siteConfig.heroBanner && <img src={siteConfig.heroBanner} alt="Prévia do banner" className="thumb wide" />}
            <input type="file" accept="image/*" onChange={escolherBanner} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Guia de medidas</h2></div>
        <Interruptor
          ligado={siteConfig.calcAtiva}
          onChange={v => atualizar({ calcAtiva: v })}
          rotulo="Calculadora inteligente de tamanho"
          descricao="Em testes: sugere o tamanho a partir de altura e peso."
        />
        <h4 className="sub-title">Tabela de medidas</h4>
        <p className="text-muted">Os tamanhos e medidas que o cliente vê no guia.</p>
        <div className="measure-list">
          {(siteConfig.tabelaMedidas || []).map((m, i) => (
            <div key={i} className="measure-row">
              <input type="text" placeholder="Tam" value={m.tam} onChange={e => mudarMedida(i, 'tam', e.target.value)} />
              <input type="text" placeholder="Altura (68cm)" value={m.altura} onChange={e => mudarMedida(i, 'altura', e.target.value)} />
              <input type="text" placeholder="Largura (48cm)" value={m.largura} onChange={e => mudarMedida(i, 'largura', e.target.value)} />
              <button className="icon-btn danger" title="Remover linha" onClick={() => atualizar({ tabelaMedidas: siteConfig.tabelaMedidas.filter((_, idx) => idx !== i) })}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" onClick={() => atualizar({ tabelaMedidas: [...(siteConfig.tabelaMedidas || []), { tam: '', altura: '', largura: '' }] })}>
          <Plus size={15} /> Adicionar linha
        </button>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Mensagens automáticas (WhatsApp)</h2></div>
        {MENSAGENS.map((m, i) => (
          <div className="input-field" key={m.campo}>
            <label>{i + 1}. {m.titulo}</label>
            <textarea rows="4" value={siteConfig[m.campo] || ''} onChange={e => atualizar({ [m.campo]: e.target.value })} />
          </div>
        ))}
        <p className="text-muted">O valor do pedido (à vista ou parcelado, conforme a forma de pagamento) é incluído automaticamente na mensagem de pedido recebido.</p>
      </div>

      <button className="btn-primary full save-bar" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando…' : '💾 Salvar configurações'}
      </button>
    </div>
  );
}
