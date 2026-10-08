import { useMemo, useState } from 'react';
import { Trash2, Pencil, Send, Download, MessageCircle } from 'lucide-react';
import { Modal, Segmentado, CampoBusca, Vazio } from './ui.jsx';
import PedidoEditModal from './PedidoEditModal.jsx';
import { fmt, formatarData, normalizar, rotuloForma } from './helpers.js';
import { filtrarParaRelatorio, resumirVendas, exportarCSV, exportarTXT, exportarPDF } from './relatorios.js';

const OPCOES_PAGAMENTO = [
  { valor: 'Pendente', rotulo: 'Pendente', tom: 'warn' },
  { valor: 'Pago', rotulo: 'Pago', tom: 'ok' }
];
const OPCOES_PRODUCAO = [
  { valor: 'Em Produção', rotulo: 'Em produção' },
  { valor: 'Pronta', rotulo: 'Pronta', tom: 'ok' },
  { valor: 'Entregue', rotulo: 'Entregue', tom: 'done' }
];

const pecasDo = (pedido) => (pedido.itens || []).reduce((acc, i) => acc + (i.quantidade || 1), 0);

const TITULOS = {
  todos: 'Pedidos',
  prontas: 'Prontas / aguardando entrega',
  entregues: 'Entregues'
};

export default function PedidosTab({ modo, pedidos, produtos, loading, busca, setBusca, api, notify, recarregar, atualizarPedidoLocal }) {
  const [filtroPag, setFiltroPag] = useState('');
  const [filtroProd, setFiltroProd] = useState('');
  const [editando, setEditando] = useState(null);
  const [relatorioAberto, setRelatorioAberto] = useState(false);

  // ── Indicadores (sempre sobre todos os pedidos, não só os filtrados) ──
  const stats = useMemo(() => {
    const r = resumirVendas(pedidos);
    const avista = (r.porForma.PIX || 0) + (r.porForma.DINHEIRO || 0);
    return { ...r, avista, cartao: r.porForma.CREDITO || 0 };
  }, [pedidos]);

  // ── Lista filtrada ──
  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return pedidos
      .filter(p => modo === 'prontas' ? p.statusProducao === 'Pronta' : modo === 'entregues' ? p.statusProducao === 'Entregue' : true)
      .filter(p => !filtroPag || p.statusPagamento === filtroPag)
      .filter(p => !filtroProd || p.statusProducao === filtroProd)
      .filter(p => !termo || normalizar(p.nome).includes(termo) || normalizar(p.pedidoId).includes(termo) || p.telefone.replace(/\D/g, '').includes(termo.replace(/\D/g, '') || '§'));
  }, [pedidos, modo, busca, filtroPag, filtroProd]);

  // ── Ações ──
  const alterarStatus = async (pedido, campos) => {
    const body = { ...campos };
    if (campos.statusPagamento === 'Pago') {
      if (!window.confirm(`Marcar o pedido de ${pedido.nome} como PAGO?`)) return;
      body.notificar = window.confirm('Enviar a mensagem de pagamento confirmado no WhatsApp do cliente?\n\nOK = enviar · Cancelar = marcar sem avisar');
    }
    const r = await api(`/api/pedidos/${pedido._id}/status`, { method: 'PUT', body });
    if (r.ok) {
      atualizarPedidoLocal(pedido._id, {
        statusPagamento: r.data.statusPagamento,
        statusProducao: r.data.statusProducao,
        pagoEm: r.data.pagoEm
      });
    } else {
      notify(r.data?.erro || 'Erro ao alterar o status.', 'erro');
    }
  };

  const excluir = async (pedido) => {
    if (!window.confirm(`Excluir PERMANENTEMENTE o pedido de ${pedido.nome}?`)) return;
    const r = await api(`/api/pedidos/${pedido._id}`, { method: 'DELETE' });
    if (r.ok) { notify('Pedido excluído.'); recarregar(); } else notify(r.data?.erro || 'Erro ao excluir.', 'erro');
  };

  const avisarPronto = async (pedido) => {
    if (!window.confirm('Enviar mensagem de WhatsApp avisando que o pedido está pronto para retirada?')) return;
    const r = await api(`/api/pedidos/${pedido._id}/notificar-pronto`, { method: 'POST' });
    notify(r.ok ? 'Mensagem enviada!' : (r.data?.erro || 'Erro ao enviar mensagem.'), r.ok ? 'ok' : 'erro');
  };

  return (
    <div className="tab-content">
      {modo === 'todos' && (
        <div className="admin-stats">
          <div className="stat-card accent">
            <h3>Faturamento recebido</h3>
            <h2>{fmt(stats.recebido)}</h2>
            <small>À vista {fmt(stats.avista)} · Cartão {fmt(stats.cartao)}</small>
          </div>
          <div className="stat-card">
            <h3>A receber</h3>
            <h2>{fmt(stats.aReceber)}</h2>
            <small>pedidos com pagamento pendente</small>
          </div>
          <div className="stat-card">
            <h3>Peças vendidas</h3>
            <h2>{stats.pecasPagas} <span>un.</span></h2>
            <small>{stats.pecasPendentes > 0 ? `+ ${stats.pecasPendentes} em pedidos pendentes` : 'em pedidos pagos'}</small>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>{TITULOS[modo]} <span className="count-chip">{visiveis.length}</span></h2>
          <div className="panel-actions">
            <button className="btn-ghost" onClick={recarregar}>Atualizar</button>
            {modo === 'todos' && (
              <button className="btn-ghost" onClick={() => setRelatorioAberto(true)}><Download size={16} /> Relatórios</button>
            )}
          </div>
        </div>

        <div className="toolbar">
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar por nome, telefone ou código…" />
          {modo === 'todos' && (
            <div className="filters">
              <select value={filtroPag} onChange={e => setFiltroPag(e.target.value)} aria-label="Filtrar por pagamento">
                <option value="">Pagamento</option>
                <option>Pendente</option>
                <option>Pago</option>
              </select>
              <select value={filtroProd} onChange={e => setFiltroProd(e.target.value)} aria-label="Filtrar por produção">
                <option value="">Produção</option>
                <option>Em Produção</option>
                <option>Pronta</option>
                <option>Entregue</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <Vazio>Carregando pedidos…</Vazio>
        ) : visiveis.length === 0 ? (
          <Vazio>{busca || filtroPag || filtroProd ? 'Nenhum pedido encontrado com esses filtros.' : 'Nenhum pedido por aqui ainda.'}</Vazio>
        ) : (
          <div className="order-list">
            {visiveis.map(pedido => (
              <article key={pedido._id} className="order-card">
                <header className="order-head">
                  <div>
                    <strong className="order-name">{pedido.nome}</strong>
                    <div className="order-meta">
                      <a href={`https://wa.me/55${pedido.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /> {pedido.telefone}</a>
                      <span>{pedido.pedidoId}</span>
                      <span>{formatarData(pedido.dataPedido)}</span>
                    </div>
                  </div>
                  <div className="order-total">
                    <strong>{fmt(pedido.valorTotal)}</strong>
                    <small>{rotuloForma(pedido.formaPagamento)} · {pecasDo(pedido)} peça(s)</small>
                  </div>
                </header>

                <ul className="order-items">
                  {pedido.itens?.map((item, idx) => (
                    <li key={item._id || idx}>
                      <span className="qty">{item.quantidade}x</span> {item.modelo}
                      <span className="text-muted"> · {[item.cor || item.tecido, item.tamanho].filter(Boolean).join(' / ')}</span>
                      {item.isProntaEntrega && ' 🔥'}
                    </li>
                  )) || <li className="text-danger">Pedido antigo sem itens</li>}
                </ul>

                <footer className="order-foot">
                  <div className="order-status">
                    <Segmentado rotulo="Pagamento" valor={pedido.statusPagamento} opcoes={OPCOES_PAGAMENTO} onChange={v => alterarStatus(pedido, { statusPagamento: v })} />
                    <Segmentado rotulo="Produção" valor={pedido.statusProducao} opcoes={OPCOES_PRODUCAO} onChange={v => alterarStatus(pedido, { statusProducao: v })} />
                  </div>
                  <div className="order-actions">
                    {pedido.statusProducao === 'Pronta' && (
                      <button className="btn-info" onClick={() => avisarPronto(pedido)}><Send size={15} /> Avisar</button>
                    )}
                    <button className="icon-btn" title="Editar pedido" onClick={() => setEditando(pedido)}><Pencil size={16} /></button>
                    <button className="icon-btn danger" title="Excluir pedido" onClick={() => excluir(pedido)}><Trash2 size={16} /></button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <PedidoEditModal
          pedido={editando}
          produtos={produtos}
          api={api}
          notify={notify}
          onClose={() => setEditando(null)}
          onSalvo={() => { setEditando(null); recarregar(); }}
        />
      )}

      {relatorioAberto && <RelatorioModal pedidos={pedidos} notify={notify} onClose={() => setRelatorioAberto(false)} />}
    </div>
  );
}

function RelatorioModal({ pedidos, notify, onClose }) {
  const [escopo, setEscopo] = useState('todos');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [gerando, setGerando] = useState(false);

  const lista = useMemo(() => filtrarParaRelatorio(pedidos, { escopo, de, ate }), [pedidos, escopo, de, ate]);
  const resumo = useMemo(() => resumirVendas(lista), [lista]);

  const gerar = async (tipo) => {
    if (lista.length === 0) return notify('Nenhum pedido no período escolhido.', 'erro');
    setGerando(true);
    try {
      if (tipo === 'csv') exportarCSV(lista);
      else if (tipo === 'txt') exportarTXT(lista);
      else await exportarPDF(lista);
    } catch (err) {
      console.error(err);
      notify('Não foi possível gerar o arquivo.', 'erro');
    }
    setGerando(false);
  };

  return (
    <Modal titulo="Relatório de vendas" onClose={onClose} largura={480}>
      <div className="input-field">
        <label>Pedidos incluídos</label>
        <select value={escopo} onChange={e => setEscopo(e.target.value)}>
          <option value="todos">Todos os pedidos</option>
          <option value="pagos">Somente pagos</option>
          <option value="pendentes">Somente pendentes</option>
        </select>
      </div>
      <div className="form-grid">
        <div className="input-field"><label>De</label><input type="date" value={de} onChange={e => setDe(e.target.value)} /></div>
        <div className="input-field"><label>Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} /></div>
      </div>

      <div className="summary-box admin">
        <div className="summary-row"><span>Pedidos no relatório</span><strong>{lista.length}</strong></div>
        <div className="summary-row"><span>Recebido (pagos)</span><strong>{fmt(resumo.recebido)}</strong></div>
        <div className="summary-row"><span>A receber (pendentes)</span><strong>{fmt(resumo.aReceber)}</strong></div>
      </div>

      <div className="export-buttons">
        <button className="btn-primary" disabled={gerando} onClick={() => gerar('pdf')}>PDF</button>
        <button className="btn-secondary" disabled={gerando} onClick={() => gerar('csv')}>Excel (CSV)</button>
        <button className="btn-secondary" disabled={gerando} onClick={() => gerar('txt')}>TXT</button>
      </div>
    </Modal>
  );
}
