import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { LogOut, LayoutDashboard, Scissors, Package, CheckCheck, MessageSquare, Store, Settings, PauseCircle, PlayCircle } from 'lucide-react';
import './index.css';
import { API_BASE } from './api.js';
import { criarApi } from './admin/helpers.js';
import PedidosTab from './admin/PedidosTab.jsx';
import ProducaoTab from './admin/ProducaoTab.jsx';
import CatalogoTab from './admin/CatalogoTab.jsx';
import SiteTab from './admin/SiteTab.jsx';
import WhatsAppTab from './admin/WhatsAppTab.jsx';

const ABAS = [
  { id: 'dashboard', rotulo: 'Pedidos', icone: LayoutDashboard },
  { id: 'catalogo', rotulo: 'Catálogo', icone: Store },
  { id: 'producao', rotulo: 'Produção', icone: Scissors },
  { id: 'prontas', rotulo: 'Prontas', icone: Package },
  { id: 'entregues', rotulo: 'Entregues', icone: CheckCheck },
  { id: 'whatsapp', rotulo: 'WhatsApp', icone: MessageSquare },
  { id: 'config', rotulo: 'Site', icone: Settings }
];

const CONFIG_INICIAL = {
  heroTitulo: '', heroSubtitulo: '', heroBanner: '', calcAtiva: false, tabelaMedidas: [],
  msgPix: '', msgCredito: '', msgDinheiro: '', msgAprovado: '', msgPronto: '',
  vendasPausadas: false, msgVendasPausadas: ''
};

function Admin() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('adminUser')));
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [cores, setCores] = useState([]);
  const [siteConfig, setSiteConfig] = useState(CONFIG_INICIAL);
  const [loading, setLoading] = useState(true); // só a primeira carga mostra "carregando"
  const [activeTab, setActiveTab] = useState('dashboard');
  const [busca, setBusca] = useState(''); // busca por cliente, compartilhada entre as abas de pedidos
  const [avisos, setAvisos] = useState([]);
  const proximoAviso = useRef(0);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setToken(null);
    setUser(null);
  }, []);

  const api = useMemo(() => criarApi(token, handleLogout), [token, handleLogout]);

  // Aviso rápido que some sozinho (substitui os alert() do painel)
  const notify = useCallback((mensagem, tipo = 'ok') => {
    const id = ++proximoAviso.current;
    setAvisos(prev => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setAvisos(prev => prev.filter(a => a.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);

  const carregarPedidos = useCallback(async () => {
    const r = await api('/api/pedidos');
    if (r.ok) setPedidos(r.data);
    setLoading(false);
  }, [api]);

  const carregarProdutos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/produtos`);
      if (res.ok) setProdutos(await res.json());
    } catch (err) {
      console.error('Erro ao carregar produtos', err);
    }
  }, []);

  const carregarCores = useCallback(async () => {
    const r = await api('/api/admin/cores');
    if (r.ok) setCores(r.data);
  }, [api]);

  const carregarConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) setSiteConfig(await res.json());
    } catch (err) {
      console.error('Erro ao carregar configuração do site', err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      // carga inicial dos dados do painel (busca na API; o estado só muda quando as respostas chegam)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      carregarPedidos();
      carregarProdutos();
      carregarCores();
      carregarConfig();
    }
  }, [token, carregarPedidos, carregarProdutos, carregarCores, carregarConfig]);

  const atualizarPedidoLocal = useCallback((id, campos) => {
    setPedidos(prev => prev.map(p => (p._id === id ? { ...p, ...campos } : p)));
  }, []);

  // Pausa/libera as vendas da loja toda (efeito imediato)
  const alternarLoja = async (pausar) => {
    const mensagem = pausar
      ? 'Pausar as vendas da LOJA INTEIRA? Os clientes não conseguirão finalizar pedidos até você liberar.'
      : 'Liberar as vendas da loja?';
    if (!window.confirm(mensagem)) return;
    const r = await api('/api/admin/config', { method: 'PUT', body: { vendasPausadas: pausar } });
    if (r.ok) {
      setSiteConfig(prev => ({ ...prev, vendasPausadas: r.data.vendasPausadas }));
      notify(pausar ? 'Vendas da loja pausadas.' : 'Vendas liberadas!');
    } else {
      notify(r.data?.erro || 'Erro ao alterar as vendas.', 'erro');
    }
  };

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
    } catch {
      alert("Erro ao conectar com o servidor.");
    }
  };

  if (!token) {
    return (
      <div className="admin-login-screen">
        <div className="admin-login-card">
          <div className="logo" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
            G34<span>Admin</span>
          </div>
          <h2>Acesso restrito</h2>
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

  const propsPedidos = { pedidos, produtos, loading, busca, setBusca, api, notify, recarregar: carregarPedidos, atualizarPedidoLocal };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="logo">G34<span>Admin</span></div>
        <div className="admin-header-right">
          <button
            className={`store-toggle ${siteConfig.vendasPausadas ? 'paused' : 'open'}`}
            onClick={() => alternarLoja(!siteConfig.vendasPausadas)}
            title={siteConfig.vendasPausadas ? 'Clique para liberar as vendas' : 'Clique para pausar as vendas da loja'}
          >
            {siteConfig.vendasPausadas ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
            <span>{siteConfig.vendasPausadas ? 'Loja pausada' : 'Loja aberta'}</span>
          </button>
          <div className="admin-profile">
            {user?.picture && <img src={user.picture} alt="Perfil" className="admin-avatar" referrerPolicy="no-referrer" />}
            <span className="admin-username">{user?.name}</span>
            <button className="btn-logout" onClick={handleLogout} title="Sair"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Seções do painel">
        {ABAS.map(({ id, rotulo, icone: Icone }) => (
          <button
            key={id}
            className={`admin-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icone size={18} /> <span>{rotulo}</span>
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {activeTab === 'dashboard' && <PedidosTab modo="todos" {...propsPedidos} />}
        {activeTab === 'prontas' && <PedidosTab modo="prontas" {...propsPedidos} />}
        {activeTab === 'entregues' && <PedidosTab modo="entregues" {...propsPedidos} />}
        {activeTab === 'producao' && <ProducaoTab {...propsPedidos} />}
        {activeTab === 'catalogo' && (
          <CatalogoTab
            produtos={produtos}
            setProdutos={setProdutos}
            cores={cores}
            api={api}
            notify={notify}
            recarregarProdutos={carregarProdutos}
            recarregarCores={carregarCores}
          />
        )}
        {activeTab === 'whatsapp' && <WhatsAppTab api={api} notify={notify} />}
        {activeTab === 'config' && (
          <SiteTab siteConfig={siteConfig} setSiteConfig={setSiteConfig} api={api} notify={notify} alternarLoja={alternarLoja} />
        )}
      </main>

      <div className="toast-stack" aria-live="polite">
        {avisos.map(a => <div key={a.id} className={`toast ${a.tipo}`}>{a.mensagem}</div>)}
      </div>
    </div>
  );
}

export default Admin;
