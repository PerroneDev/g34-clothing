// Geração dos relatórios de vendas (PDF, TXT e CSV) — tudo no navegador, sem passar pelo servidor.
import { fmt, formatarData, rotuloForma } from './helpers.js';

const descricaoItens = (pedido) =>
  (pedido.itens || [])
    .map(i => `${i.quantidade}x ${i.modelo} (${[i.cor || i.tecido, i.tamanho].filter(Boolean).join(' / ')})${i.isProntaEntrega ? ' [pronta entrega]' : ''}`)
    .join('; ');

const pecasDoPedido = (pedido) => (pedido.itens || []).reduce((acc, i) => acc + (i.quantidade || 1), 0);

/** Aplica os filtros do relatório: escopo de pagamento e período (datas yyyy-mm-dd, inclusivas) */
export function filtrarParaRelatorio(pedidos, { escopo = 'todos', de = '', ate = '' } = {}) {
  const inicio = de ? new Date(`${de}T00:00:00`) : null;
  const fim = ate ? new Date(`${ate}T23:59:59`) : null;
  return pedidos
    .filter(p => escopo === 'todos' || (escopo === 'pagos' ? p.statusPagamento === 'Pago' : p.statusPagamento === 'Pendente'))
    .filter(p => (!inicio || new Date(p.dataPedido) >= inicio) && (!fim || new Date(p.dataPedido) <= fim))
    .sort((a, b) => new Date(a.dataPedido) - new Date(b.dataPedido));
}

/** Totais usados no cabeçalho dos relatórios */
export function resumirVendas(pedidos) {
  const pagos = pedidos.filter(p => p.statusPagamento === 'Pago');
  const pendentes = pedidos.filter(p => p.statusPagamento !== 'Pago');
  const soma = (lista) => lista.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
  const porForma = {};
  pagos.forEach(p => { porForma[p.formaPagamento] = (porForma[p.formaPagamento] || 0) + (p.valorTotal || 0); });

  return {
    pedidos: pedidos.length,
    recebido: soma(pagos),
    aReceber: soma(pendentes),
    pecasPagas: pagos.reduce((acc, p) => acc + pecasDoPedido(p), 0),
    pecasPendentes: pendentes.reduce((acc, p) => acc + pecasDoPedido(p), 0),
    porForma
  };
}

const nomeArquivo = (extensao) => `vendas-g34-${new Date().toISOString().slice(0, 10)}.${extensao}`;

function baixar(conteudo, tipo, nome) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const celulaCsv = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;

/** CSV com ";" e BOM: abre direto no Excel em português, com acentos corretos */
export function exportarCSV(pedidos) {
  const cabecalho = ['Data', 'Pedido', 'Cliente', 'Telefone', 'Itens', 'Peças', 'Forma de pagamento', 'Valor (R$)', 'Pagamento', 'Produção'];
  const linhas = pedidos.map(p => [
    formatarData(p.dataPedido), p.pedidoId || '', p.nome, p.telefone, descricaoItens(p), pecasDoPedido(p),
    rotuloForma(p.formaPagamento), (p.valorTotal || 0).toFixed(2).replace('.', ','), p.statusPagamento, p.statusProducao
  ]);
  const csv = [cabecalho, ...linhas].map(l => l.map(celulaCsv).join(';')).join('\r\n');
  baixar('﻿' + csv, 'text/csv;charset=utf-8', nomeArquivo('csv'));
}

export function exportarTXT(pedidos) {
  const r = resumirVendas(pedidos);
  const linhas = [
    'G34 STORE - RELATÓRIO DE VENDAS',
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    '='.repeat(60),
    `Pedidos: ${r.pedidos}`,
    `Recebido (pagos): ${fmt(r.recebido)}  |  ${r.pecasPagas} peça(s)`,
    ...Object.entries(r.porForma).map(([f, v]) => `   - ${rotuloForma(f)}: ${fmt(v)}`),
    `A receber (pendentes): ${fmt(r.aReceber)}  |  ${r.pecasPendentes} peça(s)`,
    '='.repeat(60),
    ''
  ];
  pedidos.forEach(p => {
    linhas.push(`${formatarData(p.dataPedido)}  ${p.pedidoId || ''}  ${p.nome} (${p.telefone})`);
    (p.itens || []).forEach(i => linhas.push(`    ${i.quantidade}x ${i.modelo} - ${[i.cor || i.tecido, i.tamanho].filter(Boolean).join(' / ')}${i.isProntaEntrega ? ' [pronta entrega]' : ''}`));
    linhas.push(`    ${rotuloForma(p.formaPagamento)}: ${fmt(p.valorTotal)}  |  Pagamento: ${p.statusPagamento}  |  Produção: ${p.statusProducao}`);
    linhas.push('');
  });
  baixar(linhas.join('\r\n'), 'text/plain;charset=utf-8', nomeArquivo('txt'));
}

export async function exportarPDF(pedidos) {
  // Carregados sob demanda para não pesar o painel
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const r = resumirVendas(pedidos);
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text('G34 Store - Relatório de vendas', 14, 16);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22);

  const resumo = [
    ['Pedidos', String(r.pedidos)],
    ['Recebido (pagos)', `${fmt(r.recebido)}  (${r.pecasPagas} peça(s))`],
    ...Object.entries(r.porForma).map(([f, v]) => [`   ${rotuloForma(f)}`, fmt(v)]),
    ['A receber (pendentes)', `${fmt(r.aReceber)}  (${r.pecasPendentes} peça(s))`]
  ];
  autoTable(doc, { startY: 27, body: resumo, theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } } });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Data', 'Pedido', 'Cliente', 'Itens', 'Pagamento', 'Valor', 'Situação']],
    body: pedidos.map(p => [
      formatarData(p.dataPedido), p.pedidoId || '-', `${p.nome}\n${p.telefone}`, descricaoItens(p),
      rotuloForma(p.formaPagamento), fmt(p.valorTotal), `${p.statusPagamento} / ${p.statusProducao}`
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 3: { cellWidth: 85 } }
  });

  doc.save(nomeArquivo('pdf'));
}
