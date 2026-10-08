import { useState, useEffect } from 'react';
import './index.css';
import { API_BASE } from './api.js';

const CORES_HEX = {
  'Preto': '#111111',
  'Branco': '#F8FAFC',
  'Areia': '#E5D3B3',
  'Cinza': '#94A3B8'
};

const PAGAMENTOS = [
  { id: 'PIX', label: 'PIX', icon: '⚡', desc: 'Valor à vista' },
  { id: 'CREDITO', label: 'Cartão de Crédito', icon: '💳', desc: 'Valor parcelado · pague na maquininha' },
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵', desc: 'Valor à vista · pague presencialmente' }
];

const MODELO_PADRAO = 'Padrão';
const TAMANHOS_INFANTIS = ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos', '14 anos', '16 anos'];
const OPCOES_TAMANHOS_ORDEM = ['P', 'M', 'G', 'GG', 'XG', ...TAMANHOS_INFANTIS, 'Único'];

const fmt = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

const modelosDe = (produto) => (produto.modelos && produto.modelos.length > 0 ? produto.modelos : [MODELO_PADRAO]);

// Preços (à vista e parcelado) do modelo — já calculados pelo servidor
const precosDe = (produto, tipoModelo) =>
  (produto.precosEfetivos && produto.precosEfetivos[tipoModelo]) ||
  { avista: produto.preco || 0, parcelado: produto.precoParcelado || produto.preco || 0 };

const getImageSrc = (imagemCapa) => {
  if (!imagemCapa) return '';
  if (imagemCapa.startsWith('data:image') || imagemCapa.startsWith('http')) return imagemCapa;
  return `/images/${imagemCapa}`;
};

const nomeCor = (corObj) => (typeof corObj === 'string' ? corObj : corObj.nome);

// Tamanhos exibidos para o modelo escolhido (modelo "Infantil" só mostra tamanhos de criança)
const tamanhosDoModelo = (produto, tipoModelo) =>
  (produto.tamanhos || [])
    .filter(t => TAMANHOS_INFANTIS.includes(t) === (tipoModelo === 'Infantil'))
    .sort((a, b) => OPCOES_TAMANHOS_ORDEM.indexOf(a) - OPCOES_TAMANHOS_ORDEM.indexOf(b));

// Cores exibidas para o modelo escolhido (sem restrição cadastrada = todas)
const coresDoModelo = (produto, tipoModelo) => {
  const todas = produto.cores || [];
  const restritas = produto.coresModelos && produto.coresModelos[tipoModelo];
  if (!restritas || restritas.length === 0) return todas;
  return todas.filter(c => restritas.includes(nomeCor(c)));
};

function App() {
  const [produtos, setProdutos] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [erroProdutos, setErroProdutos] = useState(false);
  const [siteConfig, setSiteConfig] = useState({
    heroTitulo: 'Coleção\nG34 2026',
    heroSubtitulo: 'Confira os modelos exclusivos.',
    heroBanner: '',
    calcAtiva: false,
    vendasPausadas: false,
    msgVendasPausadas: '',
    tabelaMedidas: [
        { tam: 'P', altura: '68cm', largura: '48cm' },
        { tam: 'M', altura: '70cm', largura: '52cm' },
        { tam: 'G', altura: '72cm', largura: '54cm' },
        { tam: 'GG', altura: '74cm', largura: '58cm' }
    ]
  });

  useEffect(() => {
    const fetchProdutos = async () => {
      setLoadingProdutos(true);
      setErroProdutos(false);
      try {
        const res = await fetch(`${API_BASE}/api/produtos`);
        if (res.ok) {
          setProdutos(await res.json());
        } else {
          setErroProdutos(true);
        }
      } catch (err) {
        console.error("Erro ao carregar produtos:", err);
        setErroProdutos(true);
      }
      setLoadingProdutos(false);
    };

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/config`);
        if (res.ok) setSiteConfig(await res.json());
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      }
    };

    fetchProdutos();
    fetchConfig();
  }, []);

  const produtosProntaEntrega = produtos.filter(p => p.estoqueLocal && p.estoqueLocal.some(e => e.qtd > 0));

  const [view, _setView] = useState('catalog');

  const setView = (newView) => {
    if (newView === view) return;
    _setView(newView);
    window.scrollTo(0, 0);
    window.history.pushState({ view: newView }, '', '');
  };

  useEffect(() => {
    window.history.replaceState({ view }, '', '');

    const handlePopState = (event) => {
      _setView(event.state && event.state.view ? event.state.view : 'catalog');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null); // pedido criado (resposta do servidor)
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const [produtoAtual, setProdutoAtual] = useState(null);
  const [editandoIdx, setEditandoIdx] = useState(null); // índice do item do carrinho em edição

  // Carrinho de Compras
  const [carrinho, setCarrinho] = useState([]);

  // Dados do formulário para checkout
  const [formData, setFormData] = useState({ nome: '', telefone: '', formaPagamento: '' });

  // Estado temporário para a tela de Produto
  const [selecaoTemp, setSelecaoTemp] = useState({ cor: '', tipoModelo: MODELO_PADRAO, tamanho: '' });

  // Calculadora de Tamanho
  const [calcData, setCalcData] = useState(() => {
    const saved = localStorage.getItem('g34_size_data');
    return saved ? JSON.parse(saved) : { altura: '', peso: '', sexo: 'M' };
  });
  const [tamanhoSugerido, setTamanhoSugerido] = useState('');

  // Rastreio de Pedido
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [resultadoRastreio, setResultadoRastreio] = useState(null);

  const calcularTamanho = () => {
    localStorage.setItem('g34_size_data', JSON.stringify(calcData));
    const h = parseInt(calcData.altura);
    const p = parseInt(calcData.peso);
    if (!h || !p) return;

    let res;
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

  // ── Estoque e carrinho ────────────────────────────────────────────────────

  const getQuantidadeNoCarrinho = (produtoId, cor, tamanho, isProntaEntrega, ignorarIdx = editandoIdx) => {
    return carrinho.reduce((acc, i, idx) => (
      idx !== ignorarIdx && i.produtoId === produtoId && i.cor === cor && i.tamanho === tamanho && i.isProntaEntrega === isProntaEntrega
        ? acc + i.quantidade : acc
    ), 0);
  };

  const estoqueDisponivel = (produtoId, cor, tamanho) => {
    const produto = produtos.find(p => p.id === produtoId);
    const linha = produto?.estoqueLocal?.find(e => e.cor === cor && e.tamanho === tamanho);
    return linha ? linha.qtd : 0;
  };

  // Abre a tela do produto; com `item`/`idx` abre já com as escolhas de um item do carrinho (edição)
  const abrirProduto = (produto, isProntaEntrega = false, item = null, idx = null) => {
    setProdutoAtual({ ...produto, modeProntaEntrega: isProntaEntrega });
    setEditandoIdx(idx);

    if (item) {
      setSelecaoTemp({ cor: item.cor, tipoModelo: item.tipoModelo, tamanho: item.tamanho });
    } else {
      let cor = produto.cores && produto.cores[0] ? nomeCor(produto.cores[0]) : '';
      let tamanho = '';
      if (isProntaEntrega) {
        const linha = produto.estoqueLocal.find(e => e.qtd > 0) || produto.estoqueLocal[0];
        cor = linha.cor;
        tamanho = linha.tamanho;
      }
      setSelecaoTemp({ cor, tipoModelo: modelosDe(produto)[0], tamanho });
    }
    setView('product');
  };

  const editarItemDoCarrinho = (index) => {
    const item = carrinho[index];
    const produto = produtos.find(p => p.id === item.produtoId);
    if (!produto) {
      alert('Este produto não está mais disponível. Remova o item e escolha outro.');
      return;
    }
    abrirProduto(produto, item.isProntaEntrega, item, index);
  };

  const voltarDoProduto = () => {
    const estavaEditando = editandoIdx !== null;
    setEditandoIdx(null);
    setView(estavaEditando ? 'cart' : 'catalog');
  };

  const adicionarAoCarrinho = () => {
    if (siteConfig.vendasPausadas || produtoAtual.vendasPausadas) {
      alert('As vendas estão pausadas no momento.');
      return;
    }
    if (coresDoModelo(produtoAtual, selecaoTemp.tipoModelo).length > 0 && !selecaoTemp.cor) {
      alert("Por favor, escolha uma cor.");
      return;
    }
    const listaTamanhos = tamanhosDoModelo(produtoAtual, selecaoTemp.tipoModelo);
    if ((produtoAtual.tamanhos || []).length > 0 && (listaTamanhos.length === 0 || !selecaoTemp.tamanho)) {
      alert("Por favor, escolha um tamanho.");
      return;
    }
    const tamanho = (produtoAtual.tamanhos || []).length > 0 ? selecaoTemp.tamanho : 'Único';
    const cor = selecaoTemp.cor || '';
    const quantidadeBase = editandoIdx !== null ? carrinho[editandoIdx].quantidade : 1;

    if (produtoAtual.modeProntaEntrega) {
      const disponivel = estoqueDisponivel(produtoAtual.id, cor, tamanho);
      const jaNoCarrinho = getQuantidadeNoCarrinho(produtoAtual.id, cor, tamanho, true);
      if (disponivel === 0) {
        alert("Esta combinação não está disponível à pronta entrega.");
        return;
      }
      if (jaNoCarrinho + quantidadeBase > disponivel) {
        alert("Quantidade máxima disponível em estoque já adicionada.");
        return;
      }
    }

    const precos = precosDe(produtoAtual, selecaoTemp.tipoModelo);
    if (!(precos.avista > 0)) {
      alert('Este produto ainda não tem preço definido.');
      return;
    }

    const novoItem = {
      produtoId: produtoAtual.id,
      modelo: produtoAtual.modelos && produtoAtual.modelos.length > 0 ? `${produtoAtual.nome} (${selecaoTemp.tipoModelo})` : produtoAtual.nome,
      nomeProduto: produtoAtual.nome,
      tipoModelo: selecaoTemp.tipoModelo,
      semModelos: !(produtoAtual.modelos && produtoAtual.modelos.length > 0),
      cor,
      tamanho,
      precoAvista: precos.avista,
      precoParcelado: precos.parcelado,
      quantidade: quantidadeBase,
      isProntaEntrega: produtoAtual.modeProntaEntrega,
      imagemCapa: produtoAtual.imagemCapa
    };

    const mesmaVariacao = (i) =>
      i.produtoId === novoItem.produtoId && i.cor === novoItem.cor && i.tamanho === novoItem.tamanho &&
      i.tipoModelo === novoItem.tipoModelo && i.isProntaEntrega === novoItem.isProntaEntrega;

    let novoCarrinho = [...carrinho];
    if (editandoIdx !== null) {
      novoCarrinho.splice(editandoIdx, 1);
    }
    const existente = novoCarrinho.findIndex(mesmaVariacao);
    if (existente > -1) {
      novoCarrinho[existente] = { ...novoCarrinho[existente], quantidade: novoCarrinho[existente].quantidade + novoItem.quantidade };
    } else if (editandoIdx !== null) {
      novoCarrinho.splice(editandoIdx, 0, novoItem); // mantém a posição do item editado
    } else {
      novoCarrinho.push(novoItem);
    }

    setCarrinho(novoCarrinho);
    const estavaEditando = editandoIdx !== null;
    setEditandoIdx(null);
    setView(estavaEditando ? 'cart' : 'catalog');
  };

  const alterarQuantidade = (index, delta) => {
    const item = carrinho[index];
    const nova = item.quantidade + delta;
    if (nova < 1) return;
    if (delta > 0 && item.isProntaEntrega) {
      const outros = getQuantidadeNoCarrinho(item.produtoId, item.cor, item.tamanho, true, index);
      if (outros + nova > estoqueDisponivel(item.produtoId, item.cor, item.tamanho)) {
        alert('Quantidade máxima disponível em estoque.');
        return;
      }
    }
    setCarrinho(carrinho.map((i, idx) => (idx === index ? { ...i, quantidade: nova } : i)));
  };

  const removerDoCarrinho = (index) => {
    const novoCarrinho = [...carrinho];
    novoCarrinho.splice(index, 1);
    setCarrinho(novoCarrinho);
    if (novoCarrinho.length === 0) setView('catalog');
  };

  // Total do carrinho conforme a forma de pagamento (cartão = parcelado; demais = à vista)
  const calcularTotal = (forma) => {
    return carrinho.reduce((acc, item) => acc + ((forma === 'CREDITO' ? item.precoParcelado : item.precoAvista) * item.quantidade), 0);
  };

  const totalSelecionado = calcularTotal(formData.formaPagamento);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.formaPagamento) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    setLoading(true);

    // O servidor recalcula os preços a partir do catálogo: enviamos só as escolhas
    const payload = {
      nome: formData.nome,
      telefone: formData.telefone,
      formaPagamento: formData.formaPagamento,
      itens: carrinho.map(i => ({
        produtoId: i.produtoId,
        tipoModelo: i.tipoModelo,
        cor: i.cor,
        tamanho: i.tamanho,
        quantidade: i.quantidade,
        isProntaEntrega: i.isProntaEntrega
      }))
    };

    try {
      const response = await fetch(`${API_BASE}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(data);
      } else {
        alert(data.erro || 'Erro ao enviar pedido. Tente novamente.');
      }
    } catch {
      alert('Erro de conexão. Verifique sua internet e tente novamente.');
    }
    setLoading(false);
  };

  const consultarRastreio = async () => {
    if (!codigoRastreio.trim()) return alert('Digite o código do pedido.');

    try {
      const response = await fetch(`${API_BASE}/api/pedidos/rastreio/${encodeURIComponent(codigoRastreio.trim())}`);
      if (!response.ok) {
        setResultadoRastreio(null);
        alert('Pedido não encontrado. Verifique o código e tente novamente.');
        return;
      }
      setResultadoRastreio(await response.json());
    } catch {
      alert('Erro de conexão ao buscar pedido.');
    }
  };

  const DESC_PRODUCAO = {
    'Em Produção': 'Suas peças estão sendo preparadas. Em breve avisaremos para retirar.',
    'Pronta': 'Seu pedido está pronto! Procure a liderança na igreja para retirar.',
    'Entregue': 'Pedido entregue com sucesso!'
  };

  if (success) {
    return (
      <div className="success-screen">
        <div className="success-icon animate-bounce">✓</div>
        <h1>Pedido Confirmado!</h1>
        <p>Seu número de pedido é <strong style={{color: 'var(--primary)', fontSize: '1.2rem'}}>{success.pedidoId}</strong></p>
        <p>Entraremos em contato via WhatsApp no número <strong>{formData.telefone}</strong> com os próximos passos.</p>
        <div className="receipt-card">
          {success.itens.map((item, idx) => (
            <p key={idx}>
              <strong>Item:</strong> {item.quantidade}x {item.modelo} - {item.tamanho}{item.cor ? ` (${item.cor})` : ''} {item.isProntaEntrega ? '🔥' : ''}
            </p>
          ))}
          <hr style={{ margin: '10px 0', borderColor: 'var(--border)' }} />
          <p><strong>Total:</strong> {fmt(success.valorTotal)}</p>
          <p><strong>Pagamento:</strong> {PAGAMENTOS.find(p => p.id === success.formaPagamento)?.label || success.formaPagamento}</p>
        </div>
        <button className="btn-primary" onClick={() => window.location.reload()}>Voltar para a Loja</button>
      </div>
    );
  }

  const lojaPausada = !!siteConfig.vendasPausadas;
  const quantidadeTotalCarrinho = carrinho.reduce((acc, i) => acc + i.quantidade, 0);

  return (
    <div className="app-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo" onClick={() => setView('catalog')} style={{cursor: 'pointer'}}>G34<span>Store</span></div>
        <div className="nav-actions">
           {view !== 'rastreio' && (
             <span className="nav-link" onClick={() => setView('rastreio')}>
               Acompanhar Pedido
             </span>
           )}
           {carrinho.length > 0 && view === 'catalog' && (
             <div className="cart-badge" onClick={() => setView('cart')}>
               🛒 <span>{quantidadeTotalCarrinho}</span>
             </div>
           )}
        </div>
      </nav>

      {/* TELA 1: VITRINE / CATALOGO */}
      {view === 'catalog' && (
        <div className="view-fade-in">
          <header className="hero-banner" style={{
            backgroundImage: `linear-gradient(rgba(5,8,18,0.35), rgba(5,8,18,0.92)), url("${siteConfig.heroBanner || '/images/banner-placeholder.jpg'}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
            <div className="hero-content">
              <h1 style={{ whiteSpace: 'pre-line' }}>{siteConfig.heroTitulo || 'Coleção\nG34 2026'}</h1>
              <p>{siteConfig.heroSubtitulo || 'Confira os modelos exclusivos.'}</p>
            </div>
          </header>

          {lojaPausada && (
            <div className="pausa-banner">
              <strong>⏸ Vendas pausadas</strong>
              <span>{siteConfig.msgVendasPausadas || 'As vendas estão temporariamente pausadas. Volte em breve!'}</span>
            </div>
          )}

          <main className="catalog-section">

            {/* LOADING SKELETON */}
            {loadingProdutos && (
              <div>
                <div className="skeleton-header">
                  <div className="skeleton-line" style={{width: '160px', height: '24px'}}></div>
                  <div className="skeleton-line" style={{width: '60px', height: '18px'}}></div>
                </div>
                <div className="skeleton-grid">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-image"></div>
                      <div className="skeleton-info">
                        <div className="skeleton-line" style={{width: '80%'}}></div>
                        <div className="skeleton-line" style={{width: '50%', height: '12px'}}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="skeleton-msg">
                  ⏳ Carregando produtos... O servidor pode demorar alguns segundos para acordar.
                </p>
              </div>
            )}

            {/* ERRO DE CONEXÃO */}
            {erroProdutos && !loadingProdutos && (
              <div style={{textAlign: 'center', padding: '4rem 1rem'}}>
                <p style={{fontSize: '2rem', marginBottom: '1rem'}}>😕</p>
                <h3 style={{marginBottom: '0.5rem'}}>Não conseguimos carregar os produtos</h3>
                <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>Verifique sua conexão e tente novamente.</p>
                <button className="btn-primary" onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
              </div>
            )}

            {/* CONTEÚDO NORMAL */}
            {!loadingProdutos && !erroProdutos && (
              <>
                {/* SEÇÃO PRONTA ENTREGA */}
                {produtosProntaEntrega.length > 0 && (
                  <div style={{marginBottom: '2.5rem'}}>
                    <div className="section-header">
                      <h2>🔥 Pronta Entrega</h2>
                      <span>Envio imediato</span>
                    </div>
                    <div className="categories-wrapper" style={{margin: 0}}>
                      <div className="categories-scroll" style={{paddingBottom: '1rem'}}>
                        {produtosProntaEntrega.map(produto => {
                          const totalEstoque = produto.estoqueLocal.reduce((acc, curr) => acc + curr.qtd, 0);
                          const indisponivel = lojaPausada || produto.vendasPausadas;
                          return (
                            <div key={'pe-'+produto.id} className={`product-card ${indisponivel ? 'is-paused' : ''}`} style={{minWidth: '190px', maxWidth: '190px'}} onClick={() => abrirProduto(produto, true)}>
                              <div className="product-image">
                                {produto.imagemCapa
                                  ? <img src={getImageSrc(produto.imagemCapa)} alt={produto.nome} />
                                  : <span className="img-placeholder">FOTO</span>
                                }
                                <span className="badge-stock">{totalEstoque} unid.</span>
                                {produto.vendasPausadas && <span className="badge-pausa">Pausado</span>}
                              </div>
                              <div className="product-info">
                                <h3>{produto.nome}</h3>
                                {produto.aPartirDe > 0 && <span className="product-price"><small>a partir de</small> {fmt(produto.aPartirDe)}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="section-header">
                  <h2>Sob Encomenda</h2>
                  <span>{produtos.length} produtos</span>
                </div>

                <div className="product-grid">
                  {produtos.map(produto => {
                    const indisponivel = lojaPausada || produto.vendasPausadas;
                    return (
                      <div key={produto.id} className={`product-card ${indisponivel ? 'is-paused' : ''}`} onClick={() => abrirProduto(produto, false)}>
                        <div className="product-image">
                          {produto.imagemCapa
                            ? <img src={getImageSrc(produto.imagemCapa)} alt={produto.nome} />
                            : <span className="img-placeholder">FOTO AQUI</span>
                          }
                          {produto.vendasPausadas && <span className="badge-pausa">Pausado</span>}
                        </div>
                        <div className="product-info">
                          <h3>{produto.nome}</h3>
                          {produto.aPartirDe > 0 && (
                            <span className="product-price"><small>a partir de</small> {fmt(produto.aPartirDe)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </main>

          {/* FLOATING CART BUTTON */}
          {carrinho.length > 0 && (
            <div className="floating-cart">
              <button className="btn-primary full shadow-glow" onClick={() => setView('cart')}>
                Ver Carrinho ({quantidadeTotalCarrinho}) · {fmt(calcularTotal('PIX'))}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TELA 2: DETALHES DO PRODUTO */}
      {view === 'product' && produtoAtual && (() => {
        const modelos = modelosDe(produtoAtual);
        const temModelos = produtoAtual.modelos && produtoAtual.modelos.length > 0;
        const coresVisiveis = coresDoModelo(produtoAtual, selecaoTemp.tipoModelo);
        const tamanhosVisiveis = tamanhosDoModelo(produtoAtual, selecaoTemp.tipoModelo);
        const temTamanhos = (produtoAtual.tamanhos || []).length > 0;
        const precos = precosDe(produtoAtual, selecaoTemp.tipoModelo);
        const vendaBloqueada = lojaPausada || produtoAtual.vendasPausadas;
        let secao = 0;
        const proximoNumero = () => { secao += 1; return secao; };

        return (
        <div className="view-slide-up">
          <button className="btn-back" onClick={voltarDoProduto}>
            ← Voltar
          </button>

          <div className="product-showcase">
            <div className="product-large-image">
              {produtoAtual.imagemCapa
                 ? <img src={getImageSrc(produtoAtual.imagemCapa)} alt={produtoAtual.nome} />
                 : <span className="img-placeholder">FOTO AQUI</span>
              }
              {produtoAtual.modeProntaEntrega && (
                <span className="badge-stock" style={{fontSize: '1rem', padding: '0.5rem 1rem'}}>🔥 Pronta Entrega</span>
              )}
            </div>

            <div className="product-details">
              <div className="title-row">
                <h1>{produtoAtual.nome}</h1>
              </div>

              {precos.avista > 0 ? (
                <div className="price-box">
                  <div className="price-line main">
                    <span className="price-value">{fmt(precos.avista)}</span>
                    <span className="price-label">à vista · PIX ou dinheiro</span>
                  </div>
                  {precos.parcelado !== precos.avista && (
                    <div className="price-line">
                      <span className="price-value">{fmt(precos.parcelado)}</span>
                      <span className="price-label">parcelado · cartão de crédito</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="price-box"><span className="price-label">Preço a definir</span></div>
              )}

              {(produtoAtual.desc || produtoAtual.modeProntaEntrega) && (
                <p className="description">
                  {produtoAtual.desc}
                  {produtoAtual.modeProntaEntrega && " (Você está vendo as opções disponíveis para envio imediato. Quantidades limitadas)."}
                </p>
              )}

              {vendaBloqueada && (
                <div className="pausa-banner inline">
                  <strong>⏸ Vendas pausadas</strong>
                  <span>{lojaPausada ? (siteConfig.msgVendasPausadas || 'As vendas estão temporariamente pausadas.') : 'As vendas deste produto estão temporariamente pausadas.'}</span>
                </div>
              )}

              {(produtoAtual.cores || []).length > 0 && (
                <div className="selector-group">
                  <h3>{proximoNumero()}. Cor</h3>
                  <div className="color-pills-row">
                    {coresVisiveis.map(corObj => {
                      const c = nomeCor(corObj);
                      const hexCor = typeof corObj === 'string' ? (CORES_HEX[c] || '#ccc') : corObj.hex;

                      if (produtoAtual.modeProntaEntrega) {
                        const doEstoque = produtoAtual.estoqueLocal.filter(e => e.cor === c);
                        const estoqueCor = doEstoque.reduce((acc, curr) => acc + curr.qtd, 0);
                        const noCarrinho = doEstoque.reduce((acc, curr) => acc + getQuantidadeNoCarrinho(produtoAtual.id, curr.cor, curr.tamanho, true), 0);
                        if (estoqueCor - noCarrinho <= 0) return null;
                      }

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
              )}

              {temModelos && (
                <div className="selector-group">
                  <h3>{proximoNumero()}. Tipo de Produto</h3>
                  <div className="pills-row model-pills">
                    {modelos.map(m => {
                      const p = precosDe(produtoAtual, m);
                      return (
                        <button
                          key={m}
                          className={`pill model-pill ${selecaoTemp.tipoModelo === m ? 'active' : ''}`}
                          onClick={() => {
                            // Ao trocar modelo, verifica se a cor atual ainda é válida
                            const restritas = produtoAtual.coresModelos && produtoAtual.coresModelos[m];
                            const corAtualValida = !restritas || restritas.length === 0 || restritas.includes(selecaoTemp.cor);
                            setSelecaoTemp({
                              ...selecaoTemp,
                              tipoModelo: m,
                              tamanho: '',
                              cor: corAtualValida ? selecaoTemp.cor : ''
                            });
                          }}
                        >
                          <span>{m}</span>
                          {p.avista > 0 && <span className="pill-price">{fmt(p.avista)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {temTamanhos && (
                <div className="selector-group">
                  <div className="title-row">
                    <h3>{proximoNumero()}. Tamanho</h3>
                    <span className="size-guide" onClick={() => setShowSizeGuide(true)}>Guia de Medidas</span>
                  </div>
                  {tamanhosVisiveis.length === 0 && (
                    <p className="text-muted">Nenhum tamanho disponível para este modelo.</p>
                  )}
                  <div className="pills-row size-pills">
                    {tamanhosVisiveis.map(t => {
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
                            <span className="qtd-badge">{qtdDisp} unid.</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sticky-bottom">
            <button className="btn-primary full" onClick={adicionarAoCarrinho} disabled={vendaBloqueada}>
              {vendaBloqueada ? 'Vendas pausadas' : editandoIdx !== null ? 'Salvar alterações' : 'Adicionar ao Carrinho'}
            </button>
          </div>
        </div>
        );
      })()}

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
                  <div className="cart-img-mini">
                    {item.imagemCapa && <img src={getImageSrc(item.imagemCapa)} alt="" />}
                  </div>
                  <div className="cart-item-info">
                    <h4>{item.nomeProduto} {item.isProntaEntrega && <span className="badge-warning tiny">PRONTA ENTREGA</span>}</h4>
                    <p>
                      {[!item.semModelos && `Mod: ${item.tipoModelo}`, item.tamanho !== 'Único' || !item.semModelos ? `Tam: ${item.tamanho}` : null, item.cor && `Cor: ${item.cor}`].filter(Boolean).join(' | ')}
                    </p>
                    <span className="price-tag-small">{fmt(item.precoAvista * item.quantidade)}</span>
                    <div className="cart-item-actions">
                      <div className="qty-stepper">
                        <button onClick={() => alterarQuantidade(index, -1)} disabled={item.quantidade <= 1} aria-label="Diminuir">−</button>
                        <span>{item.quantidade}</span>
                        <button onClick={() => alterarQuantidade(index, 1)} aria-label="Aumentar">+</button>
                      </div>
                      <button className="btn-edit-item" onClick={() => editarItemDoCarrinho(index)}>✏️ Editar</button>
                    </div>
                  </div>
                  <button className="btn-remove" onClick={() => removerDoCarrinho(index)} aria-label="Remover item">✕</button>
                </div>
              ))}
            </div>

            <button className="btn-secondary full" onClick={() => setView('catalog')}>
              + Continuar comprando
            </button>

            <div className="summary-box">
              <div className="summary-row">
                <span>À vista <small>(PIX ou dinheiro)</small></span>
                <strong>{fmt(calcularTotal('PIX'))}</strong>
              </div>
              {calcularTotal('CREDITO') !== calcularTotal('PIX') && (
                <div className="summary-row">
                  <span>Parcelado <small>(cartão de crédito)</small></span>
                  <strong>{fmt(calcularTotal('CREDITO'))}</strong>
                </div>
              )}
            </div>

            <div className="sticky-bottom checkout-footer">
              <button className="btn-primary full shadow-glow" onClick={() => setView('checkout')} disabled={lojaPausada}>
                {lojaPausada ? 'Vendas pausadas' : 'Continuar para Pagamento'}
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
                      <span className="payment-amount">{fmt(calcularTotal(p.id))}</span>
                      <div className="radio-circle"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sticky-bottom checkout-footer">
                <button type="submit" className="btn-primary full shadow-glow" disabled={loading || lojaPausada}>
                  {loading
                    ? <div className="loader"></div>
                    : formData.formaPagamento ? `Finalizar: ${fmt(totalSelecionado)}` : 'Escolha a forma de pagamento'}
                </button>
                <p className="secure-checkout">🔒 Compra 100% segura</p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TELA 5: RASTREIO DE PEDIDO */}
      {view === 'rastreio' && (
        <div className="view-fade-in bg-alt" style={{ padding: '2rem', minHeight: '100vh' }}>
          <button className="btn-back" onClick={() => setView('catalog')}>
            ← Voltar
          </button>

          <div className="checkout-container" style={{paddingTop: '3rem'}}>
             <h1 className="checkout-title" style={{textAlign: 'center'}}>Rastreio</h1>
             <p className="text-muted" style={{textAlign: 'center', marginBottom: '2rem'}}>Acompanhe o status do seu pedido em tempo real.</p>

             <div className="input-field">
               <label>Código do Pedido</label>
               <input
                  type="text"
                  placeholder="Ex: G34-ABCD"
                  style={{textTransform: 'uppercase'}}
                  value={codigoRastreio}
                  onChange={e => setCodigoRastreio(e.target.value.toUpperCase())}
               />
               <button className="btn-primary full shadow-glow" style={{marginTop: '1rem'}} onClick={consultarRastreio}>
                 Consultar Status
               </button>
             </div>

             {resultadoRastreio && (
               <div className="tracking-result">
                 <div className={`tracking-step ${resultadoRastreio.statusPagamento === 'Pago' ? 'done' : 'wait'}`}>
                   <span className="tracking-label">Pagamento</span>
                   <h3>{resultadoRastreio.statusPagamento === 'Pago' ? 'Pago' : 'Pendente'}</h3>
                   <p>{resultadoRastreio.statusPagamento === 'Pago'
                     ? 'Recebemos o seu pagamento. Obrigado!'
                     : 'Aguardando a confirmação do pagamento via WhatsApp ou presencial.'}</p>
                 </div>
                 <div className={`tracking-step ${resultadoRastreio.statusProducao === 'Em Produção' ? 'wait' : 'done'}`}>
                   <span className="tracking-label">Produção</span>
                   <h3>{resultadoRastreio.statusProducao}</h3>
                   <p>{DESC_PRODUCAO[resultadoRastreio.statusProducao]}</p>
                 </div>
               </div>
             )}
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

            {siteConfig.calcAtiva ? (
              <div className="size-calculator">
                 <p className="text-muted" style={{marginBottom: '1rem'}}>Preencha seus dados para sugerirmos o tamanho ideal (fica salvo no seu celular).</p>

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
                    <select value={calcData.sexo} onChange={e => setCalcData({...calcData, sexo: e.target.value})}>
                       <option value="M">Masculino</option>
                       <option value="F">Feminino</option>
                    </select>
                 </div>

                 <button className="btn-primary full" style={{padding: '0.8rem', marginTop: '1rem'}} onClick={calcularTamanho}>
                   Descobrir Meu Tamanho
                 </button>

                 {tamanhoSugerido && (
                    <div className="size-suggestion">
                       <h3>Sugerimos o tamanho: <span>{tamanhoSugerido}</span></h3>
                       <button className="btn-primary" style={{padding: '0.5rem 1rem', fontSize: '0.9rem', margin: '0.75rem auto 0'}} onClick={() => { setSelecaoTemp({...selecaoTemp, tamanho: tamanhoSugerido}); setShowSizeGuide(false); }}>
                          Usar {tamanhoSugerido}
                       </button>
                    </div>
                 )}
              </div>
            ) : (
              <div className="size-calculator" style={{textAlign: 'center', padding: '2rem 0'}}>
                 <span style={{fontSize: '3rem'}}>🚧</span>
                 <h3 style={{marginTop: '1rem', color: 'var(--text-muted)'}}>Calculadora em desenvolvimento</h3>
                 <p className="text-muted">Estamos trabalhando para trazer uma inteligência que sugere o tamanho ideal pra você!</p>
              </div>
            )}

            <div style={{marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem'}}>
               <h4 style={{fontWeight: 500, color: 'var(--text-main)', marginBottom: '1rem'}}>Tabela de medidas manual</h4>
               <div className="table-responsive">
                 <table className="size-table">
                   <thead>
                     <tr>
                       <th>Tam</th>
                       <th>Altura</th>
                       <th>Largura</th>
                     </tr>
                   </thead>
                   <tbody>
                     {siteConfig.tabelaMedidas && siteConfig.tabelaMedidas.map((medida, idx) => (
                       <tr key={idx}><td>{medida.tam}</td><td>{medida.altura}</td><td>{medida.largura}</td></tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
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

      {/* FLOATING WHATSAPP BUTTON (só na vitrine e no rastreio, para não cobrir botões do fluxo de compra) */}
      {(view === 'catalog' || view === 'rastreio') && <a href="https://wa.me/5522998716574" target="_blank" rel="noreferrer" className="floating-whatsapp">
        <span className="whatsapp-icon">💬</span>
      </a>}
    </div>
  );
}

export default App;
