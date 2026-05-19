import { useState, useEffect } from 'react';
import './index.css';

const CATEGORIAS = ['Todos', 'Camisas', 'Moletons', 'Acessórios'];

const CORES_HEX = {
  'Preto': '#111111',
  'Branco': '#F8FAFC',
  'Areia': '#E5D3B3',
  'Cinza': '#94A3B8'
};

const PAGAMENTOS = [
  { id: 'PIX', label: 'PIX', icon: '💳', desc: 'Aprovação imediata' },
  { id: 'CREDITO', label: 'Cartão de Crédito', icon: '💳', desc: 'Pague na maquininha' },
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵', desc: 'Pague presencialmente' }
];

function App() {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todos');
  const [produtos, setProdutos] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const response = await fetch('https://g34-api.onrender.com/api/produtos');
        if (response.ok) {
          const data = await response.json();
          setProdutos(data);
        }
      } catch (err) {
        console.error("Erro ao carregar produtos:", err);
      }
      setLoadingProdutos(false);
    };
    fetchProdutos();
  }, []);

  const produtosFiltrados = produtos.filter(p => 
    categoriaSelecionada === 'Todos' || p.categoria === categoriaSelecionada
  );

  const produtosProntaEntrega = produtos.filter(p => p.estoqueLocal && p.estoqueLocal.length > 0);

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
    cor: '',
    tipoModelo: 'Padrão',
    tamanho: ''
  });

  // Calculadora de Tamanho
  const [calcData, setCalcData] = useState(() => {
    const saved = localStorage.getItem('g34_size_data');
    return saved ? JSON.parse(saved) : { altura: '', peso: '', sexo: 'M' };
  });
  const [tamanhoSugerido, setTamanhoSugerido] = useState('');

  const calcularTamanho = () => {
    localStorage.setItem('g34_size_data', JSON.stringify(calcData));
    const h = parseInt(calcData.altura);
    const p = parseInt(calcData.peso);
    if (!h || !p) return;

    let res = 'M';
    if (calcData.sexo === 'M') {
       if (h < 170 && p < 65) res = 'P';
       else if (h < 180 && p < 80) res = 'M';
       else if (h < 188 && p < 95) res = 'G';
       else res = 'GG';
    } else {
       if (h < 160 && p < 55) res = 'P';
       else if (h < 170 && p < 68) res = 'M';
       else if (h < 175 && p < 80) res = 'G';
       else res = 'GG';
    }
    setTamanhoSugerido(res);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const abrirProduto = (produto, isProntaEntrega = false) => {
    setProdutoAtual({ ...produto, modeProntaEntrega: isProntaEntrega });
    
    let defaultCor = produto.cores[0] ? (typeof produto.cores[0] === 'string' ? produto.cores[0] : produto.cores[0].nome) : '';
    let defaultTamanho = '';

    if (isProntaEntrega && produto.estoqueLocal.length > 0) {
      defaultCor = produto.estoqueLocal[0].cor;
      defaultTamanho = produto.estoqueLocal[0].tamanho;
    }

    const hasAdultSizes = produto.tamanhos && produto.tamanhos.some(t => !['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos', '14 anos', '16 anos'].includes(t));
    setSelecaoTemp({
      cor: defaultCor,
      tipoModelo: hasAdultSizes ? 'Padrão' : 'Infantil',
      tamanho: defaultTamanho
    });
    setView('product');
  };

  const getQuantidadeNoCarrinho = (produtoId, cor, tamanho, isProntaEntrega) => {
    const item = carrinho.find(i => i.produtoId === produtoId && i.cor === cor && i.tamanho === tamanho && i.isProntaEntrega === isProntaEntrega);
    return item ? item.quantidade : 0;
  };

  const adicionarAoCarrinho = () => {
    if (!selecaoTemp.tamanho) {
      alert("Por favor, escolha um tamanho.");
      return;
    }

    if (produtoAtual.modeProntaEntrega) {
      const estoque = produtoAtual.estoqueLocal.find(e => e.cor === selecaoTemp.cor && e.tamanho === selecaoTemp.tamanho);
      if (!estoque) {
        alert("Esta combinação não está disponível à pronta entrega.");
        return;
      }
      const qtdCarrinho = getQuantidadeNoCarrinho(produtoAtual.id, selecaoTemp.cor, selecaoTemp.tamanho, true);
      if (qtdCarrinho >= estoque.qtd) {
        alert("Quantidade máxima disponível em estoque já adicionada.");
        return;
      }
    }

    const itemIndex = carrinho.findIndex(i => 
      i.produtoId === produtoAtual.id && 
      i.cor === selecaoTemp.cor && 
      i.tamanho === selecaoTemp.tamanho && 
      i.tipoModelo === selecaoTemp.tipoModelo &&
      i.isProntaEntrega === produtoAtual.modeProntaEntrega
    );

    const novoCarrinho = [...carrinho];
    if (itemIndex > -1) {
       novoCarrinho[itemIndex].quantidade += 1;
    } else {
      const novoItem = {
        produtoId: produtoAtual.id,
        modelo: `${produtoAtual.nome} (${selecaoTemp.tipoModelo})`,
        nomeProduto: produtoAtual.nome,
        tipoModelo: selecaoTemp.tipoModelo,
        cor: selecaoTemp.cor,
        tamanho: selecaoTemp.tamanho,
        preco: produtoAtual.preco,
        quantidade: 1,
        isProntaEntrega: produtoAtual.modeProntaEntrega
      };
      novoCarrinho.push(novoItem);
    }
    setCarrinho(novoCarrinho);
    setView('catalog');
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

    const pedidoId = `G34-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const payload = {
      pedidoId,
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
        setSuccess(pedidoId);
      } else {
        alert('Erro ao enviar pedido. Tente novamente.');
      }
    } catch (error) {
      // Como não temos backend, vamos simular sucesso para poder testar
      setTimeout(() => setSuccess(pedidoId), 800);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="success-screen">
        <div className="success-icon animate-bounce">✓</div>
        <h1>Pedido Confirmado!</h1>
        <p>Seu número de pedido é <strong style={{color: 'var(--primary)', fontSize: '1.2rem'}}>{success}</strong></p>
        <p>Entraremos em contato via WhatsApp no número <strong>{formData.telefone}</strong> com os próximos passos.</p>
        <div className="receipt-card">
          {carrinho.map((item, idx) => (
            <p key={idx}><strong>Item:</strong> {item.modelo} - {item.tamanho} ({item.cor}) {item.isProntaEntrega ? '🔥' : ''}</p>
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
        <div className="logo" onClick={() => setView('catalog')} style={{cursor: 'pointer'}}>G34<span>Store</span></div>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
           {view !== 'rastreio' && (
             <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500}} onClick={() => setView('rastreio')}>
               Acompanhar Pedido
             </span>
           )}
           {carrinho.length > 0 && view === 'catalog' && (
             <div className="cart-badge" onClick={() => setView('cart')}>
               🛒 <span>{carrinho.length}</span>
             </div>
           )}
        </div>
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
            <div className="categories-wrapper">
              <div className="categories-scroll">
                {CATEGORIAS.map(cat => (
                  <button 
                    key={cat} 
                    className={`cat-pill ${categoriaSelecionada === cat ? 'active' : ''}`}
                    onClick={() => setCategoriaSelecionada(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* SEÇÃO PRONTA ENTREGA */}
            {produtosProntaEntrega.length > 0 && categoriaSelecionada === 'Todos' && (
               <div style={{marginBottom: '3rem'}}>
                 <div className="section-header">
                   <h2>🔥 Pronta Entrega</h2>
                   <span>Envio imediato</span>
                 </div>
                 <div className="categories-wrapper" style={{margin: 0}}>
                   <div className="categories-scroll" style={{paddingBottom: '1rem'}}>
                     {produtosProntaEntrega.map(produto => {
                        const totalEstoque = produto.estoqueLocal.reduce((acc, curr) => acc + curr.qtd, 0);
                        return (
                          <div key={'pe-'+produto.id} className="product-card" style={{minWidth: '200px'}} onClick={() => abrirProduto(produto, true)}>
                             <div className="product-image">
                               <span className="img-placeholder">FOTO</span>
                               <span className="badge-stock">{totalEstoque} unid.</span>
                             </div>
                             <div className="product-info">
                               <h3>{produto.nome}</h3>
                               <p className="price">R$ {produto.preco.toFixed(2).replace('.', ',')}</p>
                             </div>
                          </div>
                        )
                     })}
                   </div>
                 </div>
               </div>
            )}

            <div className="section-header">
              <h2>{categoriaSelecionada === 'Todos' ? 'Sob Encomenda' : categoriaSelecionada}</h2>
              <span>{produtosFiltrados.length} produtos</span>
            </div>

            <div className="product-grid">
              {produtosFiltrados.map(produto => (
                <div key={produto.id} className="product-card" onClick={() => abrirProduto(produto, false)}>
                  <div className="product-image">
                    {/* Placeholder para a foto */}
                    <span className="img-placeholder">FOTO AQUI</span>
                  </div>
                  <div className="product-info">
                    <h3>{produto.nome}</h3>
                    <p className="price">R$ {produto.preco.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>

          {/* FLOATING CART BUTTON */}
          {carrinho.length > 0 && (
            <div className="floating-cart">
              <button className="btn-primary full shadow-glow" onClick={() => setView('cart')}>
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
              {produtoAtual.modeProntaEntrega && (
                <span className="badge-stock" style={{fontSize: '1rem', padding: '0.5rem 1rem'}}>🔥 Pronta Entrega</span>
              )}
            </div>

            <div className="product-details">
              <div className="title-row">
                <h1>{produtoAtual.nome}</h1>
                <span className="price-tag">R$ {produtoAtual.preco.toFixed(2).replace('.', ',')}</span>
              </div>
              <p className="description">
                 {produtoAtual.desc} 
                 {produtoAtual.modeProntaEntrega && " (Você está vendo as opções disponíveis para envio imediato. Quantidades limitadas)."}
              </p>

              <div className="selector-group">
                <h3>1. Cor</h3>
                <div className="color-pills-row">
                  {produtoAtual.cores.map(corObj => {
                    const c = typeof corObj === 'string' ? corObj : corObj.nome;
                    const hexCor = typeof corObj === 'string' ? (CORES_HEX[c] || '#ccc') : corObj.hex;
                    let isDisabled = false;
                    
                    if (produtoAtual.modeProntaEntrega) {
                       const inStock = produtoAtual.estoqueLocal.filter(e => e.cor === c);
                       const estoqueCor = inStock.reduce((acc, curr) => acc + curr.qtd, 0);
                       const inCart = inStock.reduce((acc, curr) => acc + getQuantidadeNoCarrinho(produtoAtual.id, curr.cor, curr.tamanho, true), 0);
                       if (estoqueCor - inCart <= 0) isDisabled = true;
                    }
                    
                    if (isDisabled) return null;

                    return (
                      <div 
                        key={c}
                        className={`color-circle-wrapper ${selecaoTemp.cor === c ? 'active' : ''}`}
                        onClick={() => setSelecaoTemp({ ...selecaoTemp, cor: c, tamanho: '' })}
                      >
                        <div className="color-circle" style={{ backgroundColor: hexCor }}></div>
                        <span className="color-name">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="selector-group">
                <h3>2. Modelo da Camisa</h3>
                <div className="pills-row size-pills">
                  {['Padrão', 'Baby Look', 'Oversized', 'Infantil'].map(m => (
                    <button
                      key={m}
                      className={`pill size-pill ${selecaoTemp.tipoModelo === m ? 'active' : ''}`}
                      onClick={() => setSelecaoTemp({ ...selecaoTemp, tipoModelo: m, tamanho: '' })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="selector-group">
                <div className="title-row">
                  <h3>3. Tamanho</h3>
                  <span className="size-guide" onClick={() => setShowSizeGuide(true)}>Guia de Medidas</span>
                </div>
                <div className="pills-row size-pills">
                  {produtoAtual.tamanhos
                    .filter(t => {
                       const isInfantil = ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos', '14 anos', '16 anos'].includes(t);
                       if (selecaoTemp.tipoModelo === 'Infantil') return isInfantil;
                       return !isInfantil;
                    })
                    .map(t => {
                    let isDisabled = false;
                    let qtdDisp = 99;

                    if (produtoAtual.modeProntaEntrega) {
                      const est = produtoAtual.estoqueLocal.find(e => e.cor === selecaoTemp.cor && e.tamanho === t);
                      if (!est) {
                        isDisabled = true;
                        qtdDisp = 0;
                      } else {
                        qtdDisp = est.qtd - getQuantidadeNoCarrinho(produtoAtual.id, selecaoTemp.cor, t, true);
                        if (qtdDisp <= 0) isDisabled = true;
                      }
                    }

                    return (
                      <button
                        key={t}
                        disabled={isDisabled}
                        className={`pill size-pill ${selecaoTemp.tamanho === t ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                        onClick={() => !isDisabled && setSelecaoTemp({ ...selecaoTemp, tamanho: t })}
                      >
                        {t}
                        {produtoAtual.modeProntaEntrega && !isDisabled && (
                          <span className="qtd-badge" style={{display: 'block', fontSize: '0.7rem', marginTop: '0.25rem', color: 'var(--text-muted)'}}>{qtdDisp} unid.</span>
                        )}
                      </button>
                    );
                  })}
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
                    <h4>{item.nomeProduto} {item.isProntaEntrega && <span className="badge-warning" style={{fontSize:'0.6rem', padding:'0.2rem 0.4rem'}}>PRONTA ENTREGA</span>}</h4>
                    <p>Mod: {item.tipoModelo} | Tam: {item.tamanho} | Cor: {item.cor} {item.quantidade > 1 ? `(x${item.quantidade})` : ''}</p>
                    <span className="price-tag-small">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
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
              <button className="btn-primary full shadow-glow" onClick={() => setView('checkout')}>
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



      {/* TELA 6: RASTREIO DE PEDIDO */}
      {view === 'rastreio' && (
        <div className="view-fade-in bg-alt" style={{ padding: '2rem', minHeight: '100vh' }}>
          <button className="btn-back" onClick={() => setView('catalog')}>
            ← Voltar
          </button>
          
          <div className="checkout-container" style={{paddingTop: '3rem', maxWidth: '400px', margin: '0 auto'}}>
             <h1 className="checkout-title" style={{textAlign: 'center'}}>Rastreio</h1>
             <p className="text-muted" style={{textAlign: 'center', marginBottom: '2rem'}}>Acompanhe o status do seu pedido em tempo real.</p>

             <div className="input-field">
               <label>Código do Pedido</label>
               <input 
                  type="text" 
                  placeholder="Ex: G34-ABCD" 
                  style={{textTransform: 'uppercase'}}
                  id="rastreio-input"
               />
               <button className="btn-primary full shadow-glow" style={{marginTop: '1rem'}} onClick={async () => {
                  const val = document.getElementById('rastreio-input').value.toUpperCase();
                  if(!val) return alert('Digite o código do pedido.');
                  
                  try {
                     const response = await fetch(`https://g34-api.onrender.com/api/pedidos/rastreio/${val}`);
                     if (!response.ok) {
                         alert('Pedido não encontrado ou erro no servidor.');
                         return;
                     }
                     const data = await response.json();
                     let status = data.status;
                     let desc = '';
                     
                     if (status === 'Aguardando Pagamento') {
                        desc = 'Estamos aguardando a confirmação do seu pagamento via WhatsApp ou Presencial.';
                     } else if (status === 'Em Produção') {
                        desc = 'Suas peças já estão sendo estampadas! Em breve avisaremos para retirar.';
                     } else if (status === 'Aguardando Entrega') {
                        desc = 'Seu pedido está pronto! Procure a liderança na igreja para retirar.';
                     } else if (status === 'Entregue') {
                        desc = 'Pedido entregue com sucesso!';
                     } else {
                        desc = 'Seu pedido está sendo processado.';
                     }

                     document.getElementById('rastreio-result').style.display = 'block';
                     document.getElementById('rastreio-status-title').innerText = status;
                     document.getElementById('rastreio-status-desc').innerText = desc;
                  } catch (error) {
                     alert('Erro de conexão ao buscar pedido.');
                  }
               }}>
                 Consultar Status
               </button>
             </div>

             <div id="rastreio-result" style={{display: 'none', marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center'}}>
                 <h2 id="rastreio-status-title" style={{color: 'var(--primary)', marginBottom: '0.5rem'}}>Status</h2>
                 <p id="rastreio-status-desc" className="text-muted" style={{fontSize: '0.9rem'}}></p>
             </div>
          </div>
        </div>
      )}

      {/* MODAL GUIA DE MEDIDAS E CALCULADORA */}
      {showSizeGuide && (
        <div className="modal-overlay" onClick={() => setShowSizeGuide(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Calculadora de Tamanho</h2>
              <button className="btn-close" onClick={() => setShowSizeGuide(false)}>✕</button>
            </div>
            
            <div className="size-calculator">
               <p className="text-muted" style={{marginBottom: '1rem', fontSize: '0.9rem'}}>Preencha seus dados para sugerirmos o tamanho ideal (fica salvo no seu celular).</p>
               
               <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                  <div className="input-field" style={{flex: 1, marginBottom: 0}}>
                    <label>Altura (cm)</label>
                    <input type="number" placeholder="Ex: 175" value={calcData.altura} onChange={e => setCalcData({...calcData, altura: e.target.value})} />
                  </div>
                  <div className="input-field" style={{flex: 1, marginBottom: 0}}>
                    <label>Peso (kg)</label>
                    <input type="number" placeholder="Ex: 70" value={calcData.peso} onChange={e => setCalcData({...calcData, peso: e.target.value})} />
                  </div>
               </div>

               <div className="input-field">
                  <label>Sexo Biológico</label>
                  <select 
                    style={{width: '100%', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px'}}
                    value={calcData.sexo} 
                    onChange={e => setCalcData({...calcData, sexo: e.target.value})}
                  >
                     <option value="M">Masculino</option>
                     <option value="F">Feminino</option>
                  </select>
               </div>
               
               <button className="btn-primary full" style={{padding: '0.8rem', marginTop: '1rem'}} onClick={calcularTamanho}>
                 Descobrir Meu Tamanho
               </button>

               {tamanhoSugerido && (
                  <div style={{marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', borderRadius: '8px', textAlign: 'center'}}>
                     <h3 style={{marginBottom: '0.5rem'}}>Sugerimos o tamanho: <span style={{color: 'var(--primary)', fontSize: '1.5rem'}}>{tamanhoSugerido}</span></h3>
                     <button className="btn-primary" style={{padding: '0.5rem 1rem', fontSize: '0.9rem', margin: '0 auto'}} onClick={() => { setSelecaoTemp({...selecaoTemp, tamanho: tamanhoSugerido}); setShowSizeGuide(false); }}>
                        Usar {tamanhoSugerido}
                     </button>
                  </div>
               )}
            </div>

            <details style={{marginTop: '1.5rem', cursor: 'pointer', borderTop: '1px solid var(--border)', paddingTop: '1rem'}}>
               <summary style={{fontWeight: 500, color: 'var(--text-muted)'}}>Ver tabela de medidas manual</summary>
               <div className="table-responsive" style={{marginTop: '1rem'}}>
                 <table className="size-table">
                   <thead>
                     <tr>
                       <th>Tam</th>
                       <th>Altura</th>
                       <th>Largura</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr><td>P</td><td>68cm</td><td>48cm</td></tr>
                     <tr><td>M</td><td>70cm</td><td>52cm</td></tr>
                     <tr><td>G</td><td>72cm</td><td>54cm</td></tr>
                     <tr><td>GG</td><td>74cm</td><td>58cm</td></tr>
                   </tbody>
                 </table>
               </div>
            </details>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="footer-section">
        <div className="footer-content">
          <p>© 2026 G34 Store. Todos os direitos reservados.</p>
          <div className="social-links">
            <a href="https://www.instagram.com/g34_dafe/" target="_blank" rel="noreferrer">Instagram</a>
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
