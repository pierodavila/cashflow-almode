/**
 * rfm.js — Análise RFM + Sugestões de Ação
 * CashFlow v2
 *
 * R = Recência (dias desde última compra)
 * F = Frequência (nº de compras)
 * M = Valor Monetário (total gasto)
 */

// ─── Calcula RFM para cada cliente ───────────────────────────────────────────
export function calcularRFM(clientes) {
  const hoje = new Date()

  // Adiciona scores R, F, M (1-5 cada)
  const comScores = clientes.map(c => {
    const diasDesdeUltimaCompra = c.ultimaCompra
      ? Math.floor((hoje - new Date(c.ultimaCompra)) / (1000 * 60 * 60 * 24))
      : 999
    return {
      ...c,
      diasDesdeUltimaCompra,
    }
  })

  // Divide em quintis para cada dimensão
  const scoreR = quintil(comScores, 'diasDesdeUltimaCompra', true) // invertido: menor = melhor
  const scoreF = quintil(comScores, 'qtdVendas', false)
  const scoreM = quintil(comScores, 'totalCompras', false)

  return comScores.map((c, i) => {
    const r = scoreR[i]
    const f = scoreF[i]
    const m = scoreM[i]
    const rfm = r + f + m
    const segmento = classificar(r, f, m)
    return { ...c, r, f, m, rfm, segmento }
  })
}

// ─── Classifica em segmentos ─────────────────────────────────────────────────
function classificar(r, f, m) {
  if (r >= 4 && f >= 4 && m >= 4) return 'campiao'
  if (r >= 4 && f >= 3)           return 'leal'
  if (r >= 4 && f <= 2)           return 'novo'
  if (r === 3 && f >= 3)          return 'potencial'
  if (r === 3 && f <= 2)          return 'promissor'
  if (r === 2 && f >= 3)          return 'em_risco'
  if (r === 2 && f <= 2)          return 'precisa_atencao'
  if (r === 1 && f >= 3)          return 'nao_pode_perder'
  if (r === 1 && f <= 2)          return 'hibernando'
  return 'perdido'
}

// ─── Metadados dos segmentos ─────────────────────────────────────────────────
export const SEGMENTOS = {
  campiao: {
    label: 'Campeões',
    cor: '#00e5a0',
    emoji: '🏆',
    descricao: 'Compraram recentemente, com frequência e gastam muito',
    acoes: [
      'Ofereça cashback exclusivo como VIP (ex: 8%)',
      'Convide para lançamentos antes do público geral',
      'Peça indicações — programa "indique e ganhe"',
      'Envie brindes surpresa para fidelizar ainda mais'
    ]
  },
  leal: {
    label: 'Clientes Leais',
    cor: '#4fffb0',
    emoji: '⭐',
    descricao: 'Compram com frequência e recentemente',
    acoes: [
      'Aumente o cashback para 6% como recompensa',
      'Crie um clube de benefícios exclusivo',
      'Ofereça condições especiais de pagamento',
      'Mantenha contato regular com novidades'
    ]
  },
  novo: {
    label: 'Novos Clientes',
    cor: '#7c6fff',
    emoji: '🌱',
    descricao: 'Compraram recentemente mas ainda pouco',
    acoes: [
      'Dê boas-vindas com cashback extra na 2ª compra',
      'Apresente toda a linha de produtos',
      'Ofereça frete grátis na próxima compra',
      'Envie conteúdo sobre a marca para engajar'
    ]
  },
  potencial: {
    label: 'Potencial Leal',
    cor: '#a09eff',
    emoji: '💎',
    descricao: 'Compraram recentemente com frequência razoável',
    acoes: [
      'Ofereça cashback progressivo (mais compras = mais %)',
      'Apresente produtos complementares ao que comprou',
      'Crie senso de urgência com ofertas por tempo limitado'
    ]
  },
  promissor: {
    label: 'Promissores',
    cor: '#b5d4f4',
    emoji: '🚀',
    descricao: 'Compraram recentemente mas poucas vezes',
    acoes: [
      'Incentive a 2ª compra com desconto especial',
      'Mostre os produtos mais populares da loja',
      'Use cashback como gatilho para retorno'
    ]
  },
  em_risco: {
    label: 'Em Risco',
    cor: '#ffb340',
    emoji: '⚠️',
    descricao: 'Costumavam comprar bem mas sumiram',
    acoes: [
      'Envie oferta de reativação urgente',
      'Cashback extra por tempo limitado (ex: 48h)',
      'Pergunte o motivo do afastamento',
      'Ofereça condição especial para voltar'
    ]
  },
  precisa_atencao: {
    label: 'Precisa Atenção',
    cor: '#ef9f27',
    emoji: '👀',
    descricao: 'Baixa recência e frequência',
    acoes: [
      'Campanha de reengajamento com oferta agressiva',
      'Desconto + cashback combinados',
      'Comunicação personalizada com produtos do interesse'
    ]
  },
  nao_pode_perder: {
    label: 'Não Pode Perder',
    cor: '#f09595',
    emoji: '🆘',
    descricao: 'Compravam muito mas sumiram — alto valor em risco',
    acoes: [
      'PRIORIDADE MÁXIMA — contato pessoal do vendedor',
      'Oferta exclusiva e personalizada',
      'Cashback especial de reativação (ex: 10%)',
      'Descubra o motivo do abandono e resolva'
    ]
  },
  hibernando: {
    label: 'Hibernando',
    cor: '#e24b4a',
    emoji: '😴',
    descricao: 'Última compra foi há muito tempo',
    acoes: [
      'Campanha de "sentimos sua falta"',
      'Oferta de choque para reativar',
      'Se não responder, considere removê-los das campanhas'
    ]
  },
  perdido: {
    label: 'Perdidos',
    cor: '#791f1f',
    emoji: '💀',
    descricao: 'Muito tempo sem comprar e baixa frequência',
    acoes: [
      'Tentativa final com oferta máxima',
      'Se não retornar, foque em outros segmentos'
    ]
  }
}

// ─── Quintis ─────────────────────────────────────────────────────────────────
function quintil(arr, campo, inverter) {
  const valores = arr.map(c => c[campo] || 0)
  const sorted = [...valores].sort((a, b) => a - b)
  return valores.map(v => {
    const pct = sorted.indexOf(v) / sorted.length
    const score = Math.ceil(pct * 5) || 1
    return inverter ? 6 - score : score
  })
}

// ─── Resumo por segmento ──────────────────────────────────────────────────────
export function resumoPorSegmento(clientesRFM) {
  const grupos = {}
  for (const c of clientesRFM) {
    if (!grupos[c.segmento]) grupos[c.segmento] = { clientes: [], totalCashback: 0, totalCompras: 0 }
    grupos[c.segmento].clientes.push(c)
    grupos[c.segmento].totalCashback += c.cashback || 0
    grupos[c.segmento].totalCompras += c.totalCompras || 0
  }
  return grupos
}
