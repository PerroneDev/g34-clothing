import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Clock, LogOut, Trash2, LayoutDashboard, Scissors, Package, CheckCheck, Send, MessageSquare, Store, Plus, Pencil, X, Settings } from 'lucide-react';
import './index.css';
import { API_BASE } from './api.js';

const OPCOES_TAMANHOS = ['P', 'M', 'G', 'GG', 'XG', '2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos', '14 anos', '16 anos', 'Único'];

function Admin() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('adminUser')));
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ nome: '', desc: '', categoria: 'Camisas', preco: 0, cores: [], tamanhos: [], modelos: [], precosModelos: {}, coresModelos: {}, imagemCapa: '' });
  const [novaCor, setNovaCor] = useState({ nome: '', hex: '#000000' });
  const [novoModelo, setNovoModelo] = useState('');

  // Controle de Abas: 'dashboard' ou 'producao'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [waStatus, setWaStatus] = useState({ isReady: false, qrCode: '' });
  const [siteConfig, setSiteConfig] = useState({ heroTitulo: '', heroSubtitulo: '', heroBanner: '' });

  // Modal para adicionar estoque — null quando fechado, ou { produto, cor, tamanho, qtd }
  const [estoqueModal, setEstoqueModal] = useState(null);

  // Modal de edição de produto — null quando fechado, ou o produto completo clonado para edição
  const [produtoEditando, setProdutoEditando] = useState(null);
  const [novoModeloEdit, setNovoModeloEdit] = useState('');
  const [novaCorEdit, setNovaCorEdit] = useState({ nome: '', hex: '#000000' });

  useEffect(() => {
    if (token) {
      carregarPedidos();
      carregarProdutos();
      carregarConfig();
    }
  }, [token]);

  const carregarConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setSiteConfig(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração do site', error);
    }
  };

  useEffect(() => {
    let interval;
    if (token && activeTab === 'whatsapp') {
      const fetchStatus = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/whatsapp/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setWaStatus(data);
          }
        } catch (e) {
            console.error("Erro ao buscar status do whatsapp");
        }
      };
      fetchStatus();
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [token, activeTab]);

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      } else {
        alert("Erro no Login: " + data.erro);
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setToken(null);
    setUser(null);
  };

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/pedidos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPedidos(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Erro ao carregar pedidos", err);
    }
    setLoading(false);
  };

  const carregarProdutos = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/produtos`);
      if (response.ok) {
        setProdutos(await response.json());
      }
    } catch (err) {
      console.error("Erro ao carregar produtos", err);
    }
  };

  const toggleTamanho = (tam) => {
      setNovoProduto(prev => {
          const tamanhos = prev.tamanhos.includes(tam)
              ? prev.tamanhos.filter(t => t !== tam)
              : [...prev.tamanhos, tam];
          return { ...prev, tamanhos };
      });
  };

  const toggleModelo = (mod) => {
      setNovoProduto(prev => {
          const isRemoving = prev.modelos?.includes(mod);
          const modelos = isRemoving
              ? prev.modelos.filter(m => m !== mod)
              : [...(prev.modelos || []), mod];

          const precosModelos = { ...(prev.precosModelos || {}) };
          if (isRemoving) {
              delete precosModelos[mod];
          }

          return { ...prev, modelos, precosModelos };
      });
  };

  const setPrecoModelo = (mod, val) => {
      setNovoProduto(prev => ({
          ...prev,
          precosModelos: {
              ...(prev.precosModelos || {}),
              [mod]: val
          }
      }));
  };

  const adicionarCor = () => {
      if (!novaCor.nome || !novaCor.hex) return;
      setNovoProduto(prev => ({
          ...prev,
          cores: [...prev.cores, novaCor]
      }));
      setNovaCor({ nome: '', hex: '#000000' });
  };

  const removerCor = (index) => {
      setNovoProduto(prev => ({
          ...prev,
          cores: prev.cores.filter((_, i) => i !== index)
      }));
  };

  const adicionarModelo = () => {
      const nome = novoModelo.trim();
      if (!nome) return;
      if ((novoProduto.modelos || []).includes(nome)) {
          alert('Este modelo já foi adicionado.');
          return;
      }
      setNovoProduto(prev => ({
          ...prev,
          modelos: [...(prev.modelos || []), nome]
      }));
      setNovoModelo('');
  };

  const removerModelo = (mod) => {
      setNovoProduto(prev => {
          const modelos = prev.modelos.filter(m => m !== mod);
          const precosModelos = { ...prev.precosModelos };
          const coresModelos = { ...prev.coresModelos };
          delete precosModelos[mod];
          delete coresModelos[mod];
          return { ...prev, modelos, precosModelos, coresModelos };
      });
  };

  // Associa/desassocia uma cor a um modelo específico (form de adicionar)
  const toggleCorModelo = (mod, corNome) => {
      setNovoProduto(prev => {
          const atual = prev.coresModelos[mod] || [];
          const novaLista = atual.includes(corNome)
              ? atual.filter(c => c !== corNome)
              : [...atual, corNome];
          return { ...prev, coresModelos: { ...prev.coresModelos, [mod]: novaLista } };
      });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNovoProduto(prev => ({ ...prev, imagemCapa: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const salvarProduto = async () => {
    if (!novoProduto.nome) return alert('Preencha o nome do produto.');
    if (!novoProduto.modelos || novoProduto.modelos.length === 0) return alert('Adicione ao menos um modelo/variação.');

    // Calcula preco automaticamente como o menor valor entre os precosModelos
    const precos = Object.values(novoProduto.precosModelos || {})
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v) && v > 0);

    if (precos.length === 0) return alert('Defina o preço de ao menos um modelo.');

    const payload = {
        ...novoProduto,
        preco: Math.min(...precos) // menor preço como referência base
    };

    try {
      const res = await fetch(`${API_BASE}/api/admin/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        carregarProdutos();
        setNovoProduto({ nome: '', desc: '', categoria: 'Camisas', preco: 0, cores: [], tamanhos: [], modelos: [], precosModelos: {}, imagemCapa: '' });
        setNovoModelo('');
        alert('Produto salvo com sucesso!');
      } else {
        alert('Erro ao salvar produto.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  };

  const excluirProduto = async (id) => {
    if (!confirm('Excluir este produto do catálogo?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/produtos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        carregarProdutos();
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  };

  // ─── EDIÇÃO DE PRODUTO ──────────────────────────────────────────────────────

  const abrirEdicao = (produto) => {
    // Clona profundamente para não mutar o estado de listagem
    const clone = {
      ...produto,
      cores: Array.isArray(produto.cores) ? produto.cores.map(c => ({ ...c })) : [],
      tamanhos: [...(produto.tamanhos || [])],
      modelos: [...(produto.modelos || [])],
      precosModelos: { ...(produto.precosModelos || {}) },
    };
    setProdutoEditando(clone);
    setNovoModeloEdit('');
    setNovaCorEdit({ nome: '', hex: '#000000' });
  };

  const fecharEdicao = () => {
    setProdutoEditando(null);
    setNovoModeloEdit('');
    setNovaCorEdit({ nome: '', hex: '#000000' });
  };

  const salvarEdicao = async () => {
    if (!produtoEditando.nome) return alert('Preencha o nome do produto.');
    if (!produtoEditando.modelos || produtoEditando.modelos.length === 0) return alert('Adicione ao menos um modelo/variação.');

    const precos = Object.values(produtoEditando.precosModelos || {})
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v > 0);
    if (precos.length === 0) return alert('Defina o preço de ao menos um modelo.');

    const payload = { ...produtoEditando, preco: Math.min(...precos) };
    const id = produtoEditando.id || produtoEditando._id;

    try {
      const res = await fetch(`${API_BASE}/api/admin/produtos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await carregarProdutos();
        fecharEdicao();
        alert('Produto atualizado com sucesso!');
      } else {
        alert('Erro ao salvar alterações.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  };

  // Helpers exclusivos do modal de edição
  const editAdicionarCor = () => {
    if (!novaCorEdit.nome || !novaCorEdit.hex) return;
    if (produtoEditando.cores.some(c => c.nome === novaCorEdit.nome)) return alert('Cor já adicionada.');
    setProdutoEditando(prev => ({ ...prev, cores: [...prev.cores, { ...novaCorEdit }] }));
    setNovaCorEdit({ nome: '', hex: '#000000' });
  };

  const editRemoverCor = (index) => {
    setProdutoEditando(prev => ({ ...prev, cores: prev.cores.filter((_, i) => i !== index) }));
  };

  const editAdicionarModelo = () => {
    const nome = novoModeloEdit.trim();
    if (!nome) return;
    if ((produtoEditando.modelos || []).includes(nome)) return alert('Modelo já adicionado.');
    setProdutoEditando(prev => ({ ...prev, modelos: [...(prev.modelos || []), nome] }));
    setNovoModeloEdit('');
  };

  const editRemoverModelo = (mod) => {
    setProdutoEditando(prev => {
      const modelos = prev.modelos.filter(m => m !== mod);
      const precosModelos = { ...prev.precosModelos };
      const coresModelos = { ...(prev.coresModelos || {}) };
      delete precosModelos[mod];
      delete coresModelos[mod];
      return { ...prev, modelos, precosModelos, coresModelos };
    });
  };

  // Associa/desassocia uma cor a um modelo (modal de edição)
  const editToggleCorModelo = (mod, corNome) => {
    setProdutoEditando(prev => {
      const coresModelos = { ...(prev.coresModelos || {}) };
      const atual = coresModelos[mod] || [];
      const novaLista = atual.includes(corNome)
        ? atual.filter(c => c !== corNome)
        : [...atual, corNome];
      return { ...prev, coresModelos: { ...coresModelos, [mod]: novaLista } };
    });
  };

  const editSetPrecoModelo = (mod, valor) => {
    setProdutoEditando(prev => ({ ...prev, precosModelos: { ...prev.precosModelos, [mod]: valor } }));
  };

  const editToggleTamanho = (tam) => {
    setProdutoEditando(prev => ({
      ...prev,
      tamanhos: prev.tamanhos.includes(tam)
        ? prev.tamanhos.filter(t => t !== tam)
        : [...prev.tamanhos, tam]
    }));
  };

  const editHandleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProdutoEditando(prev => ({ ...prev, imagemCapa: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  // Abre o modal de adicionar estoque para um produto
  const adicionarEstoque = (produto) => {
      setEstoqueModal({ produto, cor: '', tamanho: '', qtd: '' });
  };

  // Confirma a adição de estoque a partir do modal
  const confirmarEstoque = async () => {
      const { produto, cor, tamanho, qtd: qtdStr } = estoqueModal;

      if (!cor.trim() || !tamanho.trim() || !qtdStr) {
          alert('Preencha todos os campos.');
          return;
      }
      const qtd = parseInt(qtdStr);
      if (isNaN(qtd) || qtd <= 0) {
          alert('Quantidade inválida.');
          return;
      }

      const payload = { ...produto };
      const idEstoque = `${produto.id}-${cor.toLowerCase()}-${tamanho.toLowerCase()}-${Math.random().toString(36).substr(2, 4)}`;
      const idx = payload.estoqueLocal.findIndex(
          e => e.cor.toLowerCase() === cor.toLowerCase() && e.tamanho.toLowerCase() === tamanho.toLowerCase()
      );

      if (idx > -1) {
          payload.estoqueLocal[idx].qtd += qtd;
      } else {
          payload.estoqueLocal.push({ id: idEstoque, cor: cor.trim(), tamanho: tamanho.trim(), qtd });
      }

      try {
          const res = await fetch(`${API_BASE}/api/admin/produtos/${produto.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(payload)
          });
          if (res.ok) {
              carregarProdutos();
              setEstoqueModal(null);
          } else {
              alert('Erro ao atualizar estoque');
          }
      } catch (err) {
          alert('Erro de conexão');
      }
  };

  const aprovarPedido = async (id) => {
    if (!confirm("Tem certeza que deseja marcar este pedido como aprovado/em produção? Isso enviará uma mensagem no WhatsApp do cliente.")) return;

    try {
      const response = await fetch(`${API_BASE}/api/pedidos/${id}/aprovar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        carregarPedidos();
      } else {
        alert("Erro ao aprovar pedido.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const excluirPedido = async (id) => {
    if (!confirm("Tem certeza que deseja EXCLUIR este pedido permanentemente?")) return;

    try {
      const response = await fetch(`${API_BASE}/api/pedidos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        carregarPedidos();
      } else {
        alert("Erro ao excluir pedido.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const alternarItemPronto = async (pedidoId, itemId) => {
    try {
      const response = await fetch(`${API_BASE}/api/pedidos/${pedidoId}/item/${itemId}/pronto`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        carregarPedidos();
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const notificarPronto = async (id) => {
    if (!confirm("Enviar mensagem de WhatsApp avisando que o pedido está pronto para retirada?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/pedidos/${id}/notificar-pronto`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Mensagem enviada com sucesso!");
      } else {
        alert("Erro ao enviar mensagem.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const marcarComoEntregue = async (id) => {
    if (!confirm("Marcar este pedido como entregue ao cliente?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/pedidos/${id}/entregar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        carregarPedidos();
      } else {
        alert("Erro ao marcar como entregue.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // --- CÁLCULOS FINANCEIROS ---
  const pedidosAprovados = pedidos.filter(p => p.status !== 'Aguardando Pagamento');

  const faturamentoTotal = pedidosAprovados.reduce((acc, p) => acc + (p.valorTotal || 0), 0);

  const camisasVendidas = pedidosAprovados.reduce((acc, p) => {
    const qtdePedido = p.itens?.reduce((soma, item) => soma + (item.quantidade || 1), 0) || 0;
    return acc + qtdePedido;
  }, 0);

  const ticketMedio = pedidosAprovados.length > 0 ? faturamentoTotal / pedidosAprovados.length : 0;

  // --- LISTA DE PRODUÇÃO ---
  const itensParaProducao = [];
  pedidosAprovados.forEach(p => {
    if (p.itens) {
      p.itens.forEach((item, itemIdx) => {
        if (!item.isProntaEntrega) {
          itensParaProducao.push({
            ...item,
            pedidoId: p._id,
            clienteNome: p.nome,
            dataPedido: p.dataPedido,
            _id: item._id || itemIdx
          });
        }
      });
    }
  });

  const pedidosProntos = pedidos.filter(p => p.status === 'Aguardando Entrega');
  const pedidosEntregues = pedidos.filter(p => p.status === 'Entregue');


  if (!token) {
    return (
      <div className="admin-login-screen">
        <div className="admin-login-card">
          <div className="logo" style={{justifyContent: 'center', marginBottom: '2rem'}}>
            G34<span>Admin</span>
          </div>
          <h2>Acesso Restrito</h2>
          <p>Faça login com a conta Google autorizada da liderança para acessar o painel de pedidos.</p>

          <div className="google-btn-wrapper">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => alert('Falha ao autenticar com o Google')}
              useOneTap
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="logo">G34<span>Admin</span></div>
        <div className="admin-profile">
          <img src={user?.picture} alt="Perfil" className="admin-avatar" />
          <span>{user?.name}</span>
          <button className="btn-logout" onClick={handleLogout}><LogOut size={18}/></button>
        </div>
      </header>

      {/* Navegação de Abas */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={18}/> Gestão Geral
        </button>
        <button
          className={`admin-tab ${activeTab === 'catalogo' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalogo')}
        >
          <Store size={18}/> Catálogo
        </button>
        <button
          className={`admin-tab ${activeTab === 'producao' ? 'active' : ''}`}
          onClick={() => setActiveTab('producao')}
        >
          <Scissors size={18}/> Produção
        </button>
        <button
          className={`admin-tab ${activeTab === 'prontas' ? 'active' : ''}`}
          onClick={() => setActiveTab('prontas')}
        >
          <Package size={18}/> Prontas
        </button>
        <button
          className={`admin-tab ${activeTab === 'entregues' ? 'active' : ''}`}
          onClick={() => setActiveTab('entregues')}
        >
          <CheckCheck size={18}/> Entregues
        </button>
        <button
          className={`admin-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          <MessageSquare size={18}/> WhatsApp
        </button>
        <button
          className={`admin-tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Settings size={18}/> Site
        </button>
      </div>

      <main className="admin-main">
        {activeTab === 'config' && (
          <div className="admin-section">
            <div className="section-header">
              <h2>Configurações do Site</h2>
            </div>
            <div className="admin-card" style={{ maxWidth: '600px' }}>
              <div className="input-field">
                <label>Título da Tela Inicial (Use 'Enter' para pular linha)</label>
                <textarea 
                  rows="2"
                  value={siteConfig.heroTitulo} 
                  onChange={e => setSiteConfig(prev => ({...prev, heroTitulo: e.target.value}))} 
                  placeholder="Ex: Coleção&#10;G34 2026"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                />
              </div>
              <div className="input-field">
                <label>Subtítulo da Tela Inicial</label>
                <input 
                  type="text" 
                  value={siteConfig.heroSubtitulo} 
                  onChange={e => setSiteConfig(prev => ({...prev, heroSubtitulo: e.target.value}))} 
                  placeholder="Ex: Confira os modelos exclusivos."
                />
              </div>
              <div className="input-field">
                <label>Imagem de Capa (Banner)</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {siteConfig.heroBanner && (
                    <img 
                      src={siteConfig.heroBanner} 
                      alt="Banner Preview" 
                      style={{ height: '60px', width: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} 
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setSiteConfig(prev => ({ ...prev, heroBanner: reader.result }));
                        reader.readAsDataURL(file);
                      }
                    }} 
                    style={{ flex: 1 }} 
                  />
                </div>
              </div>
              <button 
                className="btn-primary" 
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/api/admin/config`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify(siteConfig)
                    });
                    if (res.ok) {
                      alert('Configurações salvas com sucesso!');
                    } else {
                      alert('Erro ao salvar configurações.');
                    }
                  } catch (e) {
                    alert('Erro de conexão.');
                  }
                }}
              >
                💾 Salvar Configurações
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* Visão Financeira */}
            <div className="admin-stats">
              <div className="stat-card">
                <h3>Faturamento (Aprovados)</h3>
                <h2 style={{color: 'var(--primary)'}}>R$ {faturamentoTotal.toFixed(2).replace('.', ',')}</h2>
              </div>
              <div className="stat-card">
                <h3>Camisas Vendidas</h3>
                <h2>{camisasVendidas} <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>un.</span></h2>
              </div>
              <div className="stat-card">
                <h3>Ticket Médio</h3>
                <h2>R$ {ticketMedio.toFixed(2).replace('.', ',')}</h2>
              </div>
            </div>

            {/* Listagem de Pedidos */}
            <div className="admin-orders-section">
              <div className="section-title">
                <h2>Últimos Pedidos</h2>
                <button className="btn-refresh" onClick={carregarPedidos}>Atualizar</button>
              </div>

              {loading ? (
                <p>Carregando pedidos...</p>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Itens</th>
                        <th>Pagamento</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th style={{textAlign: 'right'}}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map(pedido => (
                        <tr key={pedido._id}>
                          <td>{new Date(pedido.dataPedido).toLocaleDateString('pt-BR')}</td>
                          <td>
                            <strong>{pedido.nome}</strong><br/>
                            <span className="text-muted">{pedido.telefone}</span>
                          </td>
                          <td>
                            <ul className="admin-item-list">
                              {pedido.itens?.map((item, idx) => (
                                <li key={item._id || idx}>
                                  {item.quantidade}x {item.modelo} ({item.cor || item.tecido} | {item.tamanho}) {item.isProntaEntrega && '🔥'}
                                </li>
                              )) || <span style={{color: 'red'}}>Pedido Antigo Sem Itens</span>}
                            </ul>
                          </td>
                          <td>{pedido.formaPagamento}</td>
                          <td><strong>{pedido.valorTotal ? `R$ ${pedido.valorTotal.toFixed(2).replace('.', ',')}` : 'R$ --'}</strong></td>
                          <td>
                            {pedido.status === 'Aguardando Pagamento' ? (
                              <span className="badge badge-warning"><Clock size={12}/> Aguardando</span>
                            ) : pedido.status === 'Aguardando Entrega' ? (
                              <span className="badge badge-success"><Package size={12}/> Prontas</span>
                            ) : pedido.status === 'Entregue' ? (
                              <span className="badge" style={{background: '#8b5cf6', color: '#fff'}}><CheckCheck size={12}/> Entregue</span>
                            ) : (
                              <span className="badge badge-success"><Scissors size={12}/> {pedido.status}</span>
                            )}
                          </td>
                          <td style={{textAlign: 'right', whiteSpace: 'nowrap'}}>
                            <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem'}}>
                              {pedido.status === 'Aguardando Pagamento' && (
                                <button className="btn-approve" onClick={() => aprovarPedido(pedido._id)}>
                                  Aprovar
                                </button>
                              )}
                              <button className="btn-logout" title="Excluir Pedido" onClick={() => excluirPedido(pedido._id)}>
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {pedidos.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{textAlign: 'center', padding: '2rem'}}>
                            Nenhum pedido recebido ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'catalogo' && (
          <div className="admin-orders-section">
            <div className="section-title">
              <h2>Gestão de Catálogo</h2>
              <button className="btn-refresh" onClick={carregarProdutos}>Atualizar</button>
            </div>

            <div style={{background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '2rem'}}>
               <h3><Plus size={16} style={{display: 'inline', marginRight: '8px'}}/> Adicionar Novo Produto</h3>
               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>
                 <div className="input-field">
                    <label>Nome do Produto</label>
                    <input type="text" value={novoProduto.nome} onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} placeholder="Ex: Camisa Jovem" />
                 </div>
                 <div className="input-field">
                    <label>Categoria</label>
                    <select value={novoProduto.categoria} onChange={e => setNovoProduto({...novoProduto, categoria: e.target.value})} style={{width: '100%', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px'}}>
                       <option>Camisas</option>
                       <option>Moletons</option>
                    </select>
                 </div>
                  <div className="input-field">
                     <label>Imagem da Capa</label>
                     <input type="file" accept="image/*" onChange={handleImageUpload} />
                     {novoProduto.imagemCapa && <img src={novoProduto.imagemCapa.startsWith('data:image') || novoProduto.imagemCapa.startsWith('http') ? novoProduto.imagemCapa : `/images/${novoProduto.imagemCapa}`} alt="Preview" style={{marginTop: '10px', height: '60px', borderRadius: '4px', objectFit: 'cover'}} />}
                  </div>
                 <div className="input-field">
                    <label>Descrição Opcional</label>
                    <input type="text" value={novoProduto.desc} onChange={e => setNovoProduto({...novoProduto, desc: e.target.value})} placeholder="Ex: 100% algodão" />
                 </div>
                 <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Cores</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                       <input type="text" value={novaCor.nome} onChange={e => setNovaCor({...novaCor, nome: e.target.value})} placeholder="Nome da Cor (ex: Preto)" style={{ flex: 1 }} />
                       <input type="color" value={novaCor.hex} onChange={e => setNovaCor({...novaCor, hex: e.target.value})} style={{ width: '50px', height: '38px', padding: '0', cursor: 'pointer', background: 'none', border: 'none' }} title="Escolha a cor" />
                       <input type="text" value={novaCor.hex} onChange={e => setNovaCor({...novaCor, hex: e.target.value})} placeholder="#000000" style={{ width: '100px' }} />
                       <button className="btn-approve" onClick={adicionarCor} style={{ background: 'var(--primary)' }}>+ Adicionar Cor</button>
                    </div>
                    {novoProduto.cores.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                           {novoProduto.cores.map((c, i) => (
                               <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                   <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.hex, marginRight: '0.5rem' }}></div>
                                   {c.nome} ({c.hex})
                                   <button className="btn-logout" onClick={() => removerCor(i)} style={{ marginLeft: '0.5rem', padding: '2px' }}><Trash2 size={12}/></button>
                               </div>
                           ))}
                        </div>
                    )}
                 </div>
                 <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Modelos / Variações e Preços</label>
                    {/* Input para adicionar modelo livre */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                       <input
                          type="text"
                          value={novoModelo}
                          onChange={e => setNovoModelo(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && adicionarModelo()}
                          placeholder="Nome do modelo (ex: Padrão, Baby Look, Estonada...)"
                          style={{ flex: 1 }}
                       />
                       <button className="btn-approve" onClick={adicionarModelo} style={{ background: 'var(--primary)', whiteSpace: 'nowrap' }}>
                          + Adicionar Modelo
                       </button>
                    </div>
                    {/* Lista de modelos com preço individual e cores associadas */}
                    {(novoProduto.modelos && novoProduto.modelos.length > 0) && (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {novoProduto.modelos.map(mod => (
                             <div key={mod} style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                {/* Linha: nome + preço + remover */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: novoProduto.cores.length > 0 ? '0.6rem' : 0 }}>
                                   <span style={{ flex: '0 0 auto', fontWeight: 500, minWidth: '120px' }}>{mod}</span>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>R$</span>
                                      <input
                                         type="number"
                                         min="0"
                                         step="0.01"
                                         value={(novoProduto.precosModelos && novoProduto.precosModelos[mod]) || ''}
                                         onChange={e => setPrecoModelo(mod, e.target.value)}
                                         placeholder="0,00"
                                         style={{ width: '100px', padding: '0.4rem 0.5rem', fontSize: '0.9rem' }}
                                      />
                                   </div>
                                   <button className="btn-logout" title={`Remover ${mod}`} onClick={() => removerModelo(mod)} style={{ padding: '4px' }}>
                                      <Trash2 size={14}/>
                                   </button>
                                </div>
                                {/* Checkboxes de cores disponíveis para este modelo */}
                                {novoProduto.cores.length > 0 && (
                                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '100%', marginBottom: '0.2rem' }}>Cores disponíveis neste modelo:</span>
                                      {novoProduto.cores.map(corObj => {
                                         const corNome = typeof corObj === 'string' ? corObj : corObj.nome;
                                         const corHex  = typeof corObj === 'string' ? '#ccc' : corObj.hex;
                                         const checked = (novoProduto.coresModelos[mod] || []).includes(corNome);
                                         return (
                                            <label key={corNome} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', background: checked ? 'var(--primary)' : 'var(--bg-card)', padding: '0.2rem 0.6rem', borderRadius: '20px', border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
                                               <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: corHex, flexShrink: 0 }}></div>
                                               <input type="checkbox" checked={checked} onChange={() => toggleCorModelo(mod, corNome)} style={{ display: 'none' }} />
                                               {corNome}
                                            </label>
                                         );
                                      })}
                                   </div>
                                )}
                             </div>
                          ))}
                       </div>
                    )}
                    {(!novoProduto.modelos || novoProduto.modelos.length === 0) && (
                       <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                          Adicione ao menos um modelo para definir os preços.
                       </p>
                    )}
                 </div>
                 <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Tamanhos Disponíveis</label>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                        {OPCOES_TAMANHOS.map(tam => (
                            <button
                                key={tam}
                                type="button"
                                className={`pill size-pill ${novoProduto.tamanhos.includes(tam) ? 'active' : ''}`}
                                onClick={() => toggleTamanho(tam)}
                                style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            >
                                {tam}
                            </button>
                        ))}
                    </div>
                 </div>
               </div>
               <button className="btn-primary" style={{marginTop: '1.5rem'}} onClick={salvarProduto}>
                 Salvar Produto
               </button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="col-produto">Produto</th>
                    <th className="col-cat">Categoria</th>
                    <th className="col-preco">Preço</th>
                    <th className="col-var">Variações</th>
                    <th className="col-estoque">Estoque (Pronta Entrega)</th>
                    <th className="col-acoes" style={{textAlign: 'right'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map(p => (
                    <tr key={p.id || p._id}>
                      <td className="col-produto">
                        <strong>{p.nome}</strong><br/>
                        <span className="text-muted" style={{fontSize: '0.85rem'}}>{p.desc}</span>
                      </td>
                      <td className="col-cat">{p.categoria}</td>
                      <td className="col-preco">R$ {p.preco?.toFixed(2).replace('.', ',')}</td>
                      <td className="col-var">
                        <div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                          Mod: {p.modelos?.join(', ') || 'N/A'}<br/>
                          Cores: {p.cores?.map(c => typeof c === 'string' ? c : c.nome).join(', ') || 'N/A'}<br/>
                          Tam: {p.tamanhos?.join(', ') || 'N/A'}
                        </div>
                      </td>
                      <td className="col-estoque">
                        {p.estoqueLocal && p.estoqueLocal.length > 0 ? (
                           <ul style={{fontSize: '0.85rem', paddingLeft: '1rem', color: 'var(--primary)', margin: 0}}>
                             {p.estoqueLocal.map(e => (
                               <li key={e.id}>{e.cor} - {e.tamanho}: <strong>{e.qtd} un</strong></li>
                             ))}
                           </ul>
                        ) : (
                           <span className="text-muted" style={{fontSize: '0.85rem'}}>Sem estoque</span>
                        )}
                        <button className="btn-approve" style={{marginTop: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: '0.8rem', padding: '0.3rem 0.6rem'}} onClick={() => adicionarEstoque(p)}>
                           + Estoque
                        </button>
                      </td>
                       <td className="col-acoes" style={{textAlign: 'right'}}>
                          <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                            <button className="btn-approve" title="Editar Produto" onClick={() => abrirEdicao(p)} style={{padding: '0.4rem 0.6rem', background: 'var(--bg-surface)', border: '1px solid var(--border)'}}>
                               <Pencil size={15}/>
                            </button>
                            <button className="btn-logout" title="Excluir Produto" onClick={() => excluirProduto(p.id || p._id)}>
                               <Trash2 size={15}/>
                            </button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {produtos.length === 0 && (
                    <tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem'}}>Nenhum produto cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'producao' && (
          <div className="admin-orders-section">
            <div className="section-title">
              <h2>Camisas para Estamparia</h2>
              <button className="btn-refresh" onClick={carregarPedidos}>Atualizar</button>
            </div>
            <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>
              Esta lista mostra todas as camisas individuais de pedidos que já tiveram o pagamento aprovado. Marque a caixa quando a camisa for estampada.
            </p>

            <div className="table-responsive">
              <table className="admin-table producao-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Modelo</th>
                    <th>Tamanho</th>
                    <th>Cor</th>
                    <th>Qtd</th>
                    <th>Cliente</th>
                    <th>Data do Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {itensParaProducao.map((item, idx) => (
                    <tr key={item._id || `fallback-${idx}`} className={item.pronto ? 'item-pronto' : ''}>
                      <td>
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            checked={item.pronto}
                            onChange={() => alternarItemPronto(item.pedidoId, item._id)}
                          />
                          <span className="checkmark"></span>
                        </label>
                      </td>
                      <td><strong>{item.modelo}</strong></td>
                      <td><span className="badge" style={{background: 'var(--bg-main)', border: '1px solid var(--border)'}}>{item.tamanho}</span></td>
                      <td>{item.cor || item.tecido}</td>
                      <td>{item.quantidade}x</td>
                      <td className="text-muted">{item.clienteNome}</td>
                      <td className="text-muted">{new Date(item.dataPedido).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}

                  {itensParaProducao.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{textAlign: 'center', padding: '2rem'}}>
                        Nenhuma camisa na fila de produção. Aprove pedidos na aba Geral.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'prontas' && (
          <div className="admin-orders-section">
            <div className="section-title">
              <h2>Pedidos Prontos / Aguardando Entrega</h2>
              <button className="btn-refresh" onClick={carregarPedidos}>Atualizar</button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th>Total</th>
                    <th style={{textAlign: 'right'}}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosProntos.map(pedido => (
                    <tr key={pedido._id}>
                      <td>{new Date(pedido.dataPedido).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <strong>{pedido.nome}</strong><br/>
                        <span className="text-muted">{pedido.telefone}</span>
                      </td>
                      <td>
                        <ul className="admin-item-list">
                          {pedido.itens?.map((item, idx) => (
                            <li key={item._id || idx}>
                              {item.quantidade}x {item.modelo} ({item.tamanho})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td><strong>R$ {pedido.valorTotal.toFixed(2).replace('.', ',')}</strong></td>
                      <td style={{textAlign: 'right'}}>
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.5rem'}}>
                          <button className="btn-approve" style={{background: '#3b82f6'}} onClick={() => notificarPronto(pedido._id)}>
                            <Send size={16} style={{marginRight: '4px'}}/> Avisar
                          </button>
                          <button className="btn-approve" style={{background: '#8b5cf6'}} onClick={() => marcarComoEntregue(pedido._id)}>
                            <CheckCheck size={16} style={{marginRight: '4px'}}/> Entregar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {pedidosProntos.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '2rem'}}>
                        Nenhum pedido aguardando entrega no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'entregues' && (
          <div className="admin-orders-section">
            <div className="section-title">
              <h2>Pedidos Entregues</h2>
              <button className="btn-refresh" onClick={carregarPedidos}>Atualizar</button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosEntregues.map(pedido => (
                    <tr key={pedido._id}>
                      <td>{new Date(pedido.dataPedido).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <strong>{pedido.nome}</strong><br/>
                        <span className="text-muted">{pedido.telefone}</span>
                      </td>
                      <td>
                        <ul className="admin-item-list">
                          {pedido.itens?.map((item, idx) => (
                            <li key={item._id || idx}>
                              {item.quantidade}x {item.modelo} ({item.tamanho})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td><strong>R$ {pedido.valorTotal.toFixed(2).replace('.', ',')}</strong></td>
                    </tr>
                  ))}

                  {pedidosEntregues.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{textAlign: 'center', padding: '2rem'}}>
                        Nenhum pedido entregue ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="admin-orders-section" style={{textAlign: 'center', padding: '3rem 1rem'}}>
            <h2>Status do WhatsApp Bot</h2>
            {waStatus.isReady ? (
              <div style={{marginTop: '2rem'}}>
                <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: '#22c55e', color: 'white', marginBottom: '1rem'}}>
                  <CheckCheck size={40}/>
                </div>
                <h3 style={{color: '#22c55e'}}>Conectado e Pronto!</h3>
                <p style={{color: 'var(--text-muted)'}}>O bot está online e enviando mensagens automaticamente.</p>
              </div>
            ) : waStatus.qrCode ? (
              <div style={{marginTop: '2rem'}}>
                <p style={{marginBottom: '1rem'}}>Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados</strong> e escaneie o código abaixo:</p>
                <div style={{background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '1rem'}}>
                  <QRCodeSVG value={waStatus.qrCode} size={256} />
                </div>
              </div>
            ) : (
              <div style={{marginTop: '2rem'}}>
                <p style={{color: 'var(--text-muted)'}}>Iniciando o WhatsApp ou aguardando QR Code...</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE EDIÇÃO DE PRODUTO */}
      {produtoEditando && (
        <div className="modal-overlay" onClick={fecharEdicao}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2>✏️ Editar Produto</h2>
              <button onClick={fecharEdicao} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'}}>
                <X size={20}/>
              </button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>

              {/* Nome */}
              <div className="input-field">
                <label>Nome do Produto</label>
                <input type="text" value={produtoEditando.nome} onChange={e => setProdutoEditando(p => ({...p, nome: e.target.value}))} />
              </div>

              {/* Categoria */}
              <div className="input-field">
                <label>Categoria</label>
                <select value={produtoEditando.categoria} onChange={e => setProdutoEditando(p => ({...p, categoria: e.target.value}))} style={{width: '100%', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px'}}>
                  <option>Camisas</option>
                  <option>Moletons</option>
                </select>
              </div>

              {/* Descrição */}
              <div className="input-field" style={{gridColumn: '1 / -1'}}>
                <label>Descrição</label>
                <input type="text" value={produtoEditando.desc || ''} onChange={e => setProdutoEditando(p => ({...p, desc: e.target.value}))} />
              </div>

              {/* Imagem */}
              <div className="input-field" style={{gridColumn: '1 / -1'}}>
                <label>Imagem da Capa</label>
                <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                  {produtoEditando.imagemCapa && (
                    <img
                      src={produtoEditando.imagemCapa.startsWith('data:image') || produtoEditando.imagemCapa.startsWith('http') ? produtoEditando.imagemCapa : `/images/${produtoEditando.imagemCapa}`}
                      alt="Preview"
                      style={{height: '60px', width: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)'}}
                    />
                  )}
                  <input type="file" accept="image/*" onChange={editHandleImageUpload} style={{flex: 1}} />
                </div>
              </div>

              {/* Cores */}
              <div className="input-field" style={{gridColumn: '1 / -1'}}>
                <label>Cores</label>
                <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap'}}>
                  <input type="text" value={novaCorEdit.nome} onChange={e => setNovaCorEdit(c => ({...c, nome: e.target.value}))} placeholder="Nome (ex: Preto)" style={{flex: 1, minWidth: '100px'}} />
                  <input type="color" value={novaCorEdit.hex} onChange={e => setNovaCorEdit(c => ({...c, hex: e.target.value}))} style={{width: '44px', height: '38px', padding: 0, border: 'none', background: 'none', cursor: 'pointer'}} />
                  <input type="text" value={novaCorEdit.hex} onChange={e => setNovaCorEdit(c => ({...c, hex: e.target.value}))} placeholder="#000000" style={{width: '90px'}} />
                  <button className="btn-approve" onClick={editAdicionarCor} style={{background: 'var(--primary)', whiteSpace: 'nowrap'}}>+ Cor</button>
                </div>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.4rem'}}>
                  {produtoEditando.cores.map((c, i) => (
                    <div key={i} style={{display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-surface)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem'}}>
                      <div style={{width: '10px', height: '10px', borderRadius: '50%', background: c.hex}}></div>
                      {c.nome}
                      <button onClick={() => editRemoverCor(i)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px'}}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modelos e Preços */}
              <div className="input-field" style={{gridColumn: '1 / -1'}}>
                <label>Modelos / Variações e Preços</label>
                <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center'}}>
                  <input
                    type="text"
                    value={novoModeloEdit}
                    onChange={e => setNovoModeloEdit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && editAdicionarModelo()}
                    placeholder="Nome do modelo"
                    style={{flex: 1}}
                  />
                  <button className="btn-approve" onClick={editAdicionarModelo} style={{background: 'var(--primary)', whiteSpace: 'nowrap'}}>+ Modelo</button>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {(produtoEditando.modelos || []).map(mod => (
                    <div key={mod} style={{background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)'}}>
                      {/* Linha: nome + preço + remover */}
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: produtoEditando.cores.length > 0 ? '0.6rem' : 0}}>
                        <span style={{flex: '0 0 auto', fontWeight: 500, minWidth: '110px'}}>{mod}</span>
                        <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(produtoEditando.precosModelos && produtoEditando.precosModelos[mod]) || ''}
                          onChange={e => editSetPrecoModelo(mod, e.target.value)}
                          placeholder="0,00"
                          style={{width: '90px', padding: '0.35rem 0.5rem', fontSize: '0.9rem'}}
                        />
                        <button onClick={() => editRemoverModelo(mod)} style={{marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'}}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                      {/* Checkboxes de cores disponíveis para este modelo */}
                      {produtoEditando.cores.length > 0 && (
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)'}}>
                          <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', width: '100%', marginBottom: '0.2rem'}}>Cores disponíveis neste modelo:</span>
                          {produtoEditando.cores.map(corObj => {
                            const corNome = typeof corObj === 'string' ? corObj : corObj.nome;
                            const corHex  = typeof corObj === 'string' ? '#ccc' : corObj.hex;
                            const checked = ((produtoEditando.coresModelos || {})[mod] || []).includes(corNome);
                            return (
                              <label key={corNome} style={{display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', background: checked ? 'var(--primary)' : 'var(--bg-card)', padding: '0.2rem 0.6rem', borderRadius: '20px', border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.15s'}}>
                                <div style={{width: '10px', height: '10px', borderRadius: '50%', background: corHex, flexShrink: 0}}></div>
                                <input type="checkbox" checked={checked} onChange={() => editToggleCorModelo(mod, corNome)} style={{display: 'none'}} />
                                {corNome}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tamanhos */}
              <div className="input-field" style={{gridColumn: '1 / -1'}}>
                <label>Tamanhos Disponíveis</label>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                  {OPCOES_TAMANHOS.map(tam => (
                    <button
                      key={tam}
                      type="button"
                      className={`pill size-pill ${(produtoEditando.tamanhos || []).includes(tam) ? 'active' : ''}`}
                      onClick={() => editToggleTamanho(tam)}
                      style={{margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem'}}
                    >
                      {tam}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end'}}>
              <button className="btn-logout" onClick={fecharEdicao}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEdicao}>💾 Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADICIONAR ESTOQUE */}
      {estoqueModal && (
        <div className="modal-overlay" onClick={() => setEstoqueModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2>Adicionar Estoque</h2>
              <button className="btn-close" onClick={() => setEstoqueModal(null)}>✕</button>
            </div>
            <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem'}}>
              Produto: <strong style={{color: 'white'}}>{estoqueModal.produto.nome}</strong>
            </p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div className="input-field" style={{marginBottom: 0}}>
                <label>Cor</label>
                <input
                  type="text"
                  placeholder="Ex: Preto"
                  value={estoqueModal.cor}
                  onChange={e => setEstoqueModal(prev => ({...prev, cor: e.target.value}))}
                />
              </div>
              <div className="input-field" style={{marginBottom: 0}}>
                <label>Tamanho</label>
                <input
                  type="text"
                  placeholder="Ex: M"
                  value={estoqueModal.tamanho}
                  onChange={e => setEstoqueModal(prev => ({...prev, tamanho: e.target.value}))}
                />
              </div>
              <div className="input-field" style={{marginBottom: 0}}>
                <label>Quantidade</label>
                <input
                  type="number"
                  placeholder="Ex: 10"
                  min="1"
                  value={estoqueModal.qtd}
                  onChange={e => setEstoqueModal(prev => ({...prev, qtd: e.target.value}))}
                />
              </div>
              <button className="btn-primary full" style={{marginTop: '0.5rem'}} onClick={confirmarEstoque}>
                Confirmar Estoque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
