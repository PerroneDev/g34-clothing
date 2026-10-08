import { useMemo, useState } from 'react';
import { CampoBusca, Vazio } from './ui.jsx';
import { formatarData, normalizar } from './helpers.js';

export default function ProducaoTab({ pedidos, busca, setBusca, api, notify, recarregar }) {
  const [mostrar, setMostrar] = useState('todas');

  // Todos os itens sob encomenda, de qualquer pedido (a produção pode começar antes do pagamento)
  const itens = useMemo(() => {
    const lista = [];
    pedidos.forEach(p => (p.itens || []).forEach((item, idx) => {
      if (!item.isProntaEntrega) {
        lista.push({ ...item, pedidoId: p._id, itemKey: item._id || idx, cliente: p.nome, data: p.dataPedido, pago: p.statusPagamento === 'Pago' });
      }
    }));
    return lista;
  }, [pedidos]);

  const termo = normalizar(busca.trim());
  const visiveis = itens
    .filter(i => !termo || normalizar(i.cliente).includes(termo))
    .filter(i => mostrar === 'todas' || (mostrar === 'pendentes' ? !i.pronto : i.pronto));

  const pecasPendentes = itens.filter(i => !i.pronto).reduce((acc, i) => acc + (i.quantidade || 1), 0);

  const alternar = async (item) => {
    const r = await api(`/api/pedidos/${item.pedidoId}/item/${item.itemKey}/pronto`, { method: 'PUT' });
    if (r.ok) {
      // O servidor pode ter mudado a produção do pedido (todas prontas → Pronta); recarrega para refletir
      recarregar();
    } else {
      notify(r.data?.erro || 'Erro ao atualizar o item.', 'erro');
    }
  };

  return (
    <div className="tab-content">
      <div className="panel">
        <div className="panel-head">
          <h2>Camisas para estamparia <span className="count-chip">{pecasPendentes} a fazer</span></h2>
          <div className="panel-actions"><button className="btn-ghost" onClick={recarregar}>Atualizar</button></div>
        </div>
        <p className="text-muted panel-note">
          Lista de todas as peças sob encomenda, inclusive de pedidos ainda não pagos. Marque a caixa quando a peça for estampada.
        </p>

        <div className="toolbar">
          <CampoBusca valor={busca} onChange={setBusca} />
          <div className="filters">
            <select value={mostrar} onChange={e => setMostrar(e.target.value)} aria-label="Filtrar peças">
              <option value="todas">Todas as peças</option>
              <option value="pendentes">Só as pendentes</option>
              <option value="prontas">Só as estampadas</option>
            </select>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <Vazio>{busca ? 'Nenhuma peça encontrada para esse cliente.' : 'Nenhuma peça na fila de produção.'}</Vazio>
        ) : (
          <ul className="prod-list">
            {visiveis.map(item => (
              <li key={`${item.pedidoId}-${item.itemKey}`} className={`prod-row ${item.pronto ? 'done' : ''}`}>
                <label className="checkbox-container">
                  <input type="checkbox" checked={!!item.pronto} onChange={() => alternar(item)} />
                  <span className="checkmark"></span>
                </label>
                <div className="prod-main">
                  <strong>{item.modelo}</strong>
                  <span className="text-muted">{item.cliente} · {formatarData(item.data)}</span>
                </div>
                <div className="prod-tags">
                  {(item.cor || item.tecido) && <span className="tag">{item.cor || item.tecido}</span>}
                  <span className="tag">{item.tamanho}</span>
                  <span className="tag strong">{item.quantidade}x</span>
                  <span className={`tag ${item.pago ? 'ok' : 'warn'}`}>{item.pago ? 'Pago' : 'Pendente'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
