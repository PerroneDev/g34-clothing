import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Clock, LogOut, Trash2, LayoutDashboard, Scissors, Package, CheckCheck, Send, MessageSquare, Store, Plus } from 'lucide-react';
import './index.css';

function Admin() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('adminUser')));
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ nome: '', desc: '', categoria: 'Camisas', preco: '', cores: '', tamanhos: '' });
  
  // Controle de Abas: 'dashboard' ou 'producao'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [waStatus, setWaStatus] = useState({ isReady: false, qrCode: '' });

  useEffect(() => {
    if (token) {
      carregarPedidos();
      carregarProdutos();
    }
  }, [token]);

  useEffect(() => {
    let interval;
    if (token && activeTab === 'whatsapp') {
      const fetchStatus = async () => {
        try {
          const res = await fetch('https://g34-api.onrender.com/api/whatsapp/status', {
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
      const response = await fetch('https://g34-api.onrender.com/api/admin/login', {
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
      const response = await fetch('https://g34-api.onrender.com/api/pedidos', {
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
      const response = await fetch('https://g34-api.onrender.com/api/produtos');
      if (response.ok) {
        setProdutos(await response.json());
      }
    } catch (err) {
      console.error("Erro ao carregar produtos", err);
    }
  };

  const salvarProduto = async () => {
    if (!novoProduto.nome || !novoProduto.preco) return alert('Preencha nome e preço.');
    
    const payload = {
        ...novoProduto,
        preco: parseFloat(novoProduto.preco),
        cores: novoProduto.cores.split(',').map(c => c.trim()).filter(c => c),
        tamanhos: novoProduto.tamanhos.split(',').map(t => t.trim().toUpperCase()).filter(t => t)
    };

    try {
      const res = await fetch('https://g34-api.onrender.com/api/admin/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        carregarProdutos();
        setNovoProduto({ nome: '', desc: '', categoria: 'Camisas', preco: '', cores: '', tamanhos: '' });
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
      const res = await fetch(`https://g34-api.onrender.com/api/admin/produtos/${id}`, {
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

  const adicionarEstoque = async (produto) => {
      const cor = prompt('Qual a COR da peça a pronta entrega? (ex: Preto)');
      const tamanho = prompt('Qual o TAMANHO? (ex: M)');
      const qtdStr = prompt('Quantas unidades?');
      if (!cor || !tamanho || !qtdStr) return;

      const qtd = parseInt(qtdStr);
      if (isNaN(qtd) || qtd <= 0) return alert('Quantidade inválida');

      // Clona o produto e adiciona o estoque
      const payload = { ...produto };
      const idEstoque = `${produto.id}-${cor.toLowerCase()}-${tamanho.toLowerCase()}-${Math.random().toString(36).substr(2, 4)}`;
      
      const idx = payload.estoqueLocal.findIndex(e => e.cor.toLowerCase() === cor.toLowerCase() && e.tamanho.toLowerCase() === tamanho.toLowerCase());
      
      if (idx > -1) {
          payload.estoqueLocal[idx].qtd += qtd;
      } else {
          payload.estoqueLocal.push({ id: idEstoque, cor, tamanho, qtd });
      }

      try {
        const res = await fetch(`https://g34-api.onrender.com/api/admin/produtos/${produto.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            carregarProdutos();
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
      const response = await fetch(`https://g34-api.onrender.com/api/pedidos/${id}/aprovar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        carregarPedidos(); // Recarrega a lista
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
      const response = await fetch(`https://g34-api.onrender.com/api/pedidos/${id}`, {
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
      const response = await fetch(`https://g34-api.onrender.com/api/pedidos/${pedidoId}/item/${itemId}/pronto`, {
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
      const response = await fetch(`https://g34-api.onrender.com/api/pedidos/${id}/notificar-pronto`, {
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
      const response = await fetch(`https://g34-api.onrender.com/api/pedidos/${id}/entregar`, {
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
  // Apenas pedidos "Em Produção" ou "Finalizado" (Aprovados) contam para faturamento real,
  // mas podemos mostrar o "Potencial" também se quiser. Vamos usar só os Aprovados como Dinheiro em Caixa.
  const pedidosAprovados = pedidos.filter(p => p.status !== 'Aguardando Pagamento');
  
  const faturamentoTotal = pedidosAprovados.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
  
  const camisasVendidas = pedidosAprovados.reduce((acc, p) => {
    const qtdePedido = p.itens?.reduce((soma, item) => soma + (item.quantidade || 1), 0) || 0;
    return acc + qtdePedido;
  }, 0);

  const ticketMedio = pedidosAprovados.length > 0 ? faturamentoTotal / pedidosAprovados.length : 0;

  // --- LISTA DE PRODUÇÃO ---
  // Monta uma lista flat com todas as camisas aprovadas para a aba de produção
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

  const pedidosProntos = pedidos.filter(p => p.status === 'Aguardando Entrega' || p.status === 'Finalizado');
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
      </div>

      <main className="admin-main">
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
                            ) : pedido.status === 'Finalizado' || pedido.status === 'Aguardando Entrega' ? (
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
                    <label>Preço (R$)</label>
                    <input type="number" value={novoProduto.preco} onChange={e => setNovoProduto({...novoProduto, preco: e.target.value})} placeholder="Ex: 50.00" />
                 </div>
                 <div className="input-field">
                    <label>Categoria</label>
                    <select value={novoProduto.categoria} onChange={e => setNovoProduto({...novoProduto, categoria: e.target.value})} style={{width: '100%', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px'}}>
                       <option>Camisas</option>
                       <option>Moletons</option>
                       <option>Acessórios</option>
                    </select>
                 </div>
                 <div className="input-field">
                    <label>Descrição Opcional</label>
                    <input type="text" value={novoProduto.desc} onChange={e => setNovoProduto({...novoProduto, desc: e.target.value})} placeholder="Ex: 100% algodão" />
                 </div>
                 <div className="input-field">
                    <label>Cores (separadas por vírgula)</label>
                    <input type="text" value={novoProduto.cores} onChange={e => setNovoProduto({...novoProduto, cores: e.target.value})} placeholder="Ex: Preto, Branco" />
                 </div>
                 <div className="input-field">
                    <label>Tamanhos (separados por vírgula)</label>
                    <input type="text" value={novoProduto.tamanhos} onChange={e => setNovoProduto({...novoProduto, tamanhos: e.target.value})} placeholder="Ex: P, M, G" />
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
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Preço</th>
                    <th>Variações</th>
                    <th>Estoque (Pronta Entrega)</th>
                    <th style={{textAlign: 'right'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map(p => (
                    <tr key={p.id || p._id}>
                      <td>
                        <strong>{p.nome}</strong><br/>
                        <span className="text-muted" style={{fontSize: '0.85rem'}}>{p.desc}</span>
                      </td>
                      <td>{p.categoria}</td>
                      <td>R$ {p.preco?.toFixed(2).replace('.', ',')}</td>
                      <td>
                        <div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                          Cores: {p.cores?.join(', ') || 'N/A'}<br/>
                          Tam: {p.tamanhos?.join(', ') || 'N/A'}
                        </div>
                      </td>
                      <td>
                        {p.estoqueLocal && p.estoqueLocal.length > 0 ? (
                           <ul style={{fontSize: '0.85rem', paddingLeft: '1rem', color: 'var(--primary)'}}>
                             {p.estoqueLocal.map(e => (
                               <li key={e.id}>{e.cor} - {e.tamanho}: <strong>{e.qtd} un</strong></li>
                             ))}
                           </ul>
                        ) : (
                           <span className="text-muted" style={{fontSize: '0.85rem'}}>Sem estoque físico</span>
                        )}
                        <button className="btn-approve" style={{marginTop: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: '0.8rem', padding: '0.3rem 0.6rem'}} onClick={() => adicionarEstoque(p)}>
                           + Adicionar Estoque
                        </button>
                      </td>
                      <td style={{textAlign: 'right'}}>
                         <button className="btn-logout" title="Excluir Produto" onClick={() => excluirProduto(p.id || p._id)}>
                            <Trash2 size={16}/>
                         </button>
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
    </div>
  );
}

export default Admin;
