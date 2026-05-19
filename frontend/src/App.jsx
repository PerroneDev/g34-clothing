import { useState, useEffect } from 'react';
import './index.css';

const CAMISAS = [
  {
    id: 'leao',
    nome: 'Estampa Leão',
    desc: 'Design exclusivo com o Leão da Tribo de Judá.',
    tecidos: ['Premium', 'Comum'],
    preco: 50.00
  },
  {
    id: 'cruz',
    nome: 'Estampa Cruz',
    desc: 'Minimalista e impactante.',
    tecidos: ['Premium', 'Baby Look'],
    preco: 50.00
  },
  {
    id: 'oversized',
    nome: 'Oversized Logo',
    desc: 'Modelo mais largo, estilo street.',
    tecidos: ['Premium'],
    preco: 60.00
  }
];

const TAMANHOS = ['P', 'M', 'G', 'GG'];
const PAGAMENTOS = [
  { id: 'PIX', label: 'PIX', icon: '💳', desc: 'Aprovação imediata' },
  { id: 'CREDITO', label: 'Cartão de Crédito', icon: '💳', desc: 'Pague na maquininha' },
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵', desc: 'Pague presencialmente' }
];

function App() {
  const [view, _setView] = useState(() => {
    if (window.location.pathname === '/admin') {
      return 'admin';
    }
    return 'catalog';
  });

  const setView = (newView) => {
    if (newView === view) return;
    _setView(newView);
    window.scrollTo(0, 0);
    window.history.pushState({ view: newView }, '', '');
  };

  useEffect(() => {
    // Guarda o estado inicial no history ao abrir
    window.history.replaceState({ view }, '', '');

    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        _setView(event.state.view);
      } else {
        _setView(window.location.pathname === '/admin' ? 'admin' : 'catalog');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const [produtoAtual, setProdutoAtual] = useState(null);

  // Carrinho de Compras
  const [carrinho, setCarrinho] = useState([]);

  // Dados do formulário para checkout
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    formaPagamento: ''
  });

  // Estado temporário para a tela de Produto
  const [selecaoTemp, setSelecaoTemp] = useState({
    tecido: '',
    tamanho: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const abrirProduto = (produto) => {
    setProdutoAtual(produto);
    setSelecaoTemp({
      tecido: produto.tecidos[0], // Seleciona o primeiro por padrão
      tamanho: ''
    });
    setView('product');
    window.scrollTo(0, 0);
  };

  const adicionarAoCarrinho = () => {
    if (!selecaoTemp.tamanho) {
      alert("Por favor, escolha um tamanho.");
      return;
    }

    const novoItem = {
      modelo: produtoAtual.nome,
      tecido: selecaoTemp.tecido,
      tamanho: selecaoTemp.tamanho,
      preco: produtoAtual.preco,
      quantidade: 1
    };

    setCarrinho([...carrinho, novoItem]);
    setView('catalog');
    window.scrollTo(0, 0);
  };

  const removerDoCarrinho = (index) => {
    const novoCarrinho = [...carrinho];
    novoCarrinho.splice(index, 1);
    setCarrinho(novoCarrinho);
    if (novoCarrinho.length === 0) setView('catalog');
  };

  const calcularTotal = () => {
    return carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.formaPagamento) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    setLoading(true);

    const payload = {
      nome: formData.nome,
      telefone: formData.telefone,
      formaPagamento: formData.formaPagamento,
      itens: carrinho,
      valorTotal: calcularTotal()
    };

    try {
      const response = await fetch('https://g34-api.onrender.com/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setSuccess(true);
      } else {
        alert('Erro ao enviar pedido. Tente novamente.');
      }
    } catch (error) {
      alert('Erro de conexão com o servidor.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="success-screen">
        <div className="success-icon animate-bounce">✓</div>
        <h1>Pedido Confirmado!</h1>
        <p>Entraremos em contato via WhatsApp no número <strong>{formData.telefone}</strong> com os próximos passos.</p>
        <div className="receipt-card">
          {carrinho.map((item, idx) => (
            <p key={idx}><strong>Item:</strong> {item.modelo} - {item.tamanho} ({item.tecido})</p>
          ))}
          <hr style={{ margin: '10px 0', borderColor: 'var(--border)' }} />
          <p><strong>Total:</strong> R$ {calcularTotal().toFixed(2).replace('.', ',')}</p>
          <p><strong>Pagamento:</strong> {formData.formaPagamento}</p>
        </div>
        <button className="btn-primary" onClick={() => window.location.reload()}>Voltar para a Loja</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo">G34<span>Store</span></div>
        {carrinho.length > 0 && view === 'catalog' && (
          <div className="cart-badge" onClick={() => setView('cart')}>
            🛒 <span>{carrinho.length}</span>
          </div>
        )}
      </nav>

      {/* TELA 1: VITRINE / CATALOGO */}
      {view === 'catalog' && (
        <div className="view-fade-in">
          <header className="hero-banner">
            <div className="hero-content">
              <h1>Coleção<br />Congresso '26</h1>
              <p>Imperfeitos, mas chamados.</p>
            </div>
          </header>

          <main className="catalog-section">
            <div className="section-header">
              <h2>Lançamentos</h2>
              <span>{CAMISAS.length} produtos</span>
            </div>

            <div className="product-grid">
              {CAMISAS.map(camisa => (
                <div key={camisa.id} className="product-card" onClick={() => abrirProduto(camisa)}>
                  <div className="product-image">
                    {/* Placeholder para a foto */}
                    <span className="img-placeholder">FOTO AQUI</span>
                  </div>
                  <div className="product-info">
                    <h3>{camisa.nome}</h3>
                    <p className="price">R$ {camisa.preco.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>

          {/* FLOATING CART BUTTON */}
          {carrinho.length > 0 && (
            <div className="floating-cart">
              <button className="btn-primary full shadow-glow" onClick={() => { setView('cart'); window.scrollTo(0, 0); }}>
                Ver Carrinho ({carrinho.length}) - R$ {calcularTotal().toFixed(2).replace('.', ',')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TELA 2: DETALHES DO PRODUTO */}
      {view === 'product' && produtoAtual && (
        <div className="view-slide-up">
          <button className="btn-back" onClick={() => setView('catalog')}>
            ← Voltar
          </button>

          <div className="product-showcase">
            <div className="product-large-image">
              <span className="img-placeholder">FOTO AQUI</span>
            </div>

            <div className="product-details">
              <div className="title-row">
                <h1>{produtoAtual.nome}</h1>
                <span className="price-tag">R$ {produtoAtual.preco.toFixed(2).replace('.', ',')}</span>
              </div>
              <p className="description">{produtoAtual.desc}</p>

              <div className="selector-group">
                <h3>1. Tipo de Tecido</h3>
                <div className="pills-row">
                  {produtoAtual.tecidos.map(t => (
                    <button
                      key={t}
                      className={`pill ${selecaoTemp.tecido === t ? 'active' : ''}`}
                      onClick={() => setSelecaoTemp({ ...selecaoTemp, tecido: t })}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="selector-group">
                <div className="title-row">
                  <h3>2. Tamanho</h3>
                  <span className="size-guide" onClick={() => setShowSizeGuide(true)}>Guia de Medidas</span>
                </div>
                <div className="pills-row size-pills">
                  {TAMANHOS.map(t => (
                    <button
                      key={t}
                      className={`pill size-pill ${selecaoTemp.tamanho === t ? 'active' : ''}`}
                      onClick={() => setSelecaoTemp({ ...selecaoTemp, tamanho: t })}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="sticky-bottom">
            <button className="btn-primary full" onClick={adicionarAoCarrinho}>
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
      )}

      {/* TELA 3: CARRINHO DE COMPRAS */}
      {view === 'cart' && (
        <div className="view-slide-up bg-alt">
          <button className="btn-back" onClick={() => setView('catalog')}>
            ← Voltar
          </button>

          <div className="checkout-container">
            <h1 className="checkout-title">Seu Carrinho</h1>

            <div className="cart-list">
              {carrinho.map((item, index) => (
                <div key={index} className="cart-item">
                  <div className="cart-img-mini"></div>
                  <div className="cart-item-info">
                    <h4>{item.modelo}</h4>
                    <p>Tam: {item.tamanho} | {item.tecido}</p>
                    <span className="price-tag-small">R$ {item.preco.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <button className="btn-remove" onClick={() => removerDoCarrinho(index)}>✕</button>
                </div>
              ))}
            </div>

            <div className="cart-total-row">
              <h3>Total:</h3>
              <h2>R$ {calcularTotal().toFixed(2).replace('.', ',')}</h2>
            </div>

            <div className="sticky-bottom checkout-footer">
              <button className="btn-primary full shadow-glow" onClick={() => { setView('checkout'); window.scrollTo(0, 0); }}>
                Continuar para Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA 4: CHECKOUT (PAGAMENTO E DADOS) */}
      {view === 'checkout' && (
        <div className="view-slide-up bg-alt">
          <button className="btn-back" onClick={() => setView('cart')}>
            ← Voltar
          </button>

          <div className="checkout-container">
            <h1 className="checkout-title">Pagamento</h1>

            <form onSubmit={handleSubmit} className="checkout-form">
              <div className="form-section">
                <h3>Seus Dados</h3>
                <div className="input-field">
                  <label>Nome Completo</label>
                  <input
                    type="text"
                    name="nome"
                    placeholder="Como devemos te chamar?"
                    required
                    value={formData.nome}
                    onChange={handleChange}
                  />
                </div>
                <div className="input-field">
                  <label>WhatsApp (com DDD)</label>
                  <input
                    type="tel"
                    name="telefone"
                    placeholder="Ex: 22 99999-9999"
                    required
                    value={formData.telefone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Forma de Pagamento</h3>
                <div className="payment-options">
                  {PAGAMENTOS.map(p => (
                    <div
                      key={p.id}
                      className={`payment-card ${formData.formaPagamento === p.id ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, formaPagamento: p.id })}
                    >
                      <div className="payment-icon">{p.icon}</div>
                      <div className="payment-info">
                        <span className="payment-label">{p.label}</span>
                        <span className="payment-desc">{p.desc}</span>
                      </div>
                      <div className="radio-circle"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sticky-bottom checkout-footer">
                <button type="submit" className="btn-primary full shadow-glow" disabled={loading}>
                  {loading ? <div className="loader"></div> : `Finalizar: R$ ${calcularTotal().toFixed(2).replace('.', ',')}`}
                </button>
                <p className="secure-checkout">🔒 Compra 100% segura</p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TELA 5: PAINEL ADMIN */}
      {view === 'admin' && (
        <div className="view-fade-in bg-alt" style={{ padding: '2rem' }}>
          <h1>Painel da Liderança</h1>
          <p>Área restrita para gestão de pedidos do Congresso.</p>
          {/* Aqui vai entrar a sua tabela de pedidos depois */}

          <button className="btn-back" onClick={() => { _setView('catalog'); window.history.pushState({ view: 'catalog' }, '', '/'); }}>
            ← Voltar para a Loja
          </button>
        </div>
      )}

      {/* MODAL GUIA DE MEDIDAS */}
      {showSizeGuide && (
        <div className="modal-overlay" onClick={() => setShowSizeGuide(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Guia de Medidas</h2>
              <button className="btn-close" onClick={() => setShowSizeGuide(false)}>✕</button>
            </div>
            <div className="table-responsive">
              <table className="size-table">
                <thead>
                  <tr>
                    <th>Tamanho</th>
                    <th>Altura (cm)</th>
                    <th>Largura (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>P</td><td>68</td><td>48</td></tr>
                  <tr><td>M</td><td>70</td><td>52</td></tr>
                  <tr><td>G</td><td>72</td><td>54</td></tr>
                  <tr><td>GG</td><td>74</td><td>58</td></tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              * As medidas podem variar em até 2cm para mais ou para menos.
            </p>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="footer-section">
        <div className="footer-content">
          <p>© 2026 G34 Store. Todos os direitos reservados.</p>
          <div className="social-links">
            <a href="https://instagram.com/g34" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
      </footer>

      {/* FLOATING WHATSAPP BUTTON */}
      <a href="https://wa.me/5522999999999" target="_blank" rel="noreferrer" className="floating-whatsapp">
        <span className="whatsapp-icon">💬</span>
      </a>
    </div>
  );
}

export default App;
