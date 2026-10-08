import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCheck } from 'lucide-react';

export default function WhatsAppTab({ api, notify }) {
  const [status, setStatus] = useState({ isReady: false, qrCode: '' });

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      const r = await api('/api/whatsapp/status');
      if (ativo && r.ok) setStatus(r.data);
    };
    buscar();
    const intervalo = setInterval(buscar, 3000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, [api]);

  const reiniciar = async () => {
    if (!window.confirm('Tem certeza que deseja sair do WhatsApp e reiniciar a sessão? Isso derrubará a conexão e exigirá a leitura de um novo QR Code.')) return;
    const r = await api('/api/whatsapp/reset', { method: 'POST' });
    if (r.ok) {
      notify('Comando enviado! O servidor vai reiniciar. Aguarde até um novo QR Code aparecer.');
      setStatus({ isReady: false, qrCode: '' });
    } else {
      notify('Erro ao tentar desconectar.', 'erro');
    }
  };

  return (
    <div className="tab-content narrow">
      <div className="panel center">
        <h2>Status do WhatsApp</h2>
        {status.isReady ? (
          <div className="wa-state">
            <div className="wa-icon ok"><CheckCheck size={40} /></div>
            <h3 className="text-success">Conectado e pronto!</h3>
            <p className="text-muted">O bot está online e enviando mensagens automaticamente.</p>
          </div>
        ) : status.qrCode ? (
          <div className="wa-state">
            <p>Abra o WhatsApp no celular, vá em <strong>Aparelhos conectados</strong> e escaneie o código:</p>
            <div className="qr-box"><QRCodeSVG value={status.qrCode} size={240} /></div>
          </div>
        ) : (
          <div className="wa-state"><p className="text-muted">Iniciando o WhatsApp ou aguardando o QR Code…</p></div>
        )}
        <div className="wa-reset">
          <button className="btn-danger" onClick={reiniciar}>🔄 Desconectar e reiniciar sessão</button>
        </div>
      </div>
    </div>
  );
}
