import { X } from 'lucide-react';

/** Janela modal: no celular ocupa a tela toda (folha inferior), no PC fica centralizada */
export function Modal({ titulo, onClose, children, largura = 560, rodape }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-admin" style={{ maxWidth: largura }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {rodape && <div className="modal-footer">{rodape}</div>}
      </div>
    </div>
  );
}

/** Seletor de opções lado a lado (usado nos status de pagamento e produção) */
export function Segmentado({ valor, opcoes, onChange, rotulo }) {
  return (
    <div className="seg-group">
      {rotulo && <span className="seg-label">{rotulo}</span>}
      <div className="seg" role="group" aria-label={rotulo}>
        {opcoes.map(o => (
          <button
            key={o.valor}
            type="button"
            className={`seg-btn ${valor === o.valor ? 'active' : ''} ${o.tom ? `tom-${o.tom}` : ''}`}
            onClick={() => valor !== o.valor && onChange(o.valor)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Interruptor liga/desliga */
export function Interruptor({ ligado, onChange, rotulo, descricao, desativado }) {
  return (
    <label className={`switch-row ${desativado ? 'disabled' : ''}`}>
      <span className="switch-text">
        <strong>{rotulo}</strong>
        {descricao && <small>{descricao}</small>}
      </span>
      <input type="checkbox" checked={!!ligado} disabled={desativado} onChange={e => onChange(e.target.checked)} />
      <span className="switch-track"><span className="switch-thumb" /></span>
    </label>
  );
}

export function CampoBusca({ valor, onChange, placeholder = 'Buscar por nome do cliente…' }) {
  return (
    <div className="search-box">
      <input type="search" value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Vazio({ children }) {
  return <div className="empty-state">{children}</div>;
}
