/**
 * rfm.js — Análise RFM + Sugestões de Ação
 * CashFlow v2
 */

// Normaliza datas em formatos DD-MM-YYYY e ISO para Date
function parseDate(str) {
  if (!str) return new Date(0)
  // Formato DD-MM-YYYY do portal antigo
  const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (ddmmyyyy) return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`)
  // Formato ISO ou qualquer outro
  return new Date(str)
}

export function calcularRFM(clientes) {
  const hoje = new Date()
  const comDias = clientes.map(c => ({
    ...c,
    diasDesdeUltimaCompra: c.ultimaCompra
      ? Math.floor((hoje - parseDate(c.ultimaCompra)) / 86400000)
      : 999
  }))
  const sR = quintil(comDias, 'diasDesdeUltimaCompra', true)
  const sF = quintil(comDias, 'qtdVendas', false)
  const sM = quintil(comDias, 'totalCompras', false)
  return comDias.map((c, i) => {
    const r = sR[i], f = sF[i], m = sM[i]
    return { ...c, r, f, m, rfm: r+f+m, segmento: classificar(r,f,m) }
  })
}

function classificar(r,f,m) {
  if (r>=4&&f>=4&&m>=4) return 'campiao'
  if (r>=4&&f>=3)       return 'leal'
  if (r>=4&&f<=2)       return 'novo'
  if (r===3&&f>=3)      return 'potencial'
  if (r===3&&f<=2)      return 'promissor'
  if (r===2&&f>=3)      return 'em_risco'
  if (r===2&&f<=2)      return 'precisa_atencao'
  if (r===1&&f>=3)      return 'nao_pode_perder'
  if (r===1&&f<=2)      return 'hibernando'
  return 'perdido'
}

// O(n log n) — usa Map de rank para evitar indexOf O(n²)
function quintil(arr, campo, inv) {
  const vals = arr.map(c => c[campo]||0)
  const n = vals.length
  const sorted = [...vals].sort((a,b)=>a-b)
  const rankMap = new Map()
  sorted.forEach((v,i) => { if (!rankMap.has(v)) rankMap.set(v, i) })
  return vals.map(v => {
    const s = Math.ceil((rankMap.get(v)/n)*5)||1
    return inv ? 6-s : s
  })
}

export function resumoPorSegmento(rfm) {
  const g = {}
  for (const c of rfm) {
    if (!g[c.segmento]) g[c.segmento] = { clientes:[], totalCashback:0, totalCompras:0 }
    g[c.segmento].clientes.push(c)
    g[c.segmento].totalCashback += c.cashback||0
    g[c.segmento].totalCompras += c.totalCompras||0
  }
  return g
}

export const SEGMENTOS = {
  campiao:          { label:'Campeões',          emoji:'🏆', cor:'#00e5a0', cashbackSugerido:8,  msg:'Você é VIP na {loja}! Como presente especial, seu cashback subiu para 8% nas próximas compras. Obrigado por ser incrível! 🏆' },
  leal:             { label:'Leais',             emoji:'⭐', cor:'#4fffb0', cashbackSugerido:7,  msg:'Olá {nome}! Você é um dos nossos clientes mais fiéis na {loja} e queremos te recompensar com cashback especial de 7%! ⭐' },
  novo:             { label:'Novos',             emoji:'🌱', cor:'#7c6fff', cashbackSugerido:6,  msg:'Bem-vindo(a) {nome}! Ficamos felizes com sua primeira compra na {loja}. Ganhe cashback EXTRA de 6% na sua próxima visita! 🎁' },
  potencial:        { label:'Potencial Leal',    emoji:'💎', cor:'#a09eff', cashbackSugerido:6,  msg:'{nome}, você está quase no clube VIP da {loja}! Mais uma compra e seu cashback sobe para 7%. Que tal dar uma passadinha? 💎' },
  promissor:        { label:'Promissores',       emoji:'🚀', cor:'#85b7eb', cashbackSugerido:5,  msg:'Oi {nome}! Temos novidades incríveis na {loja} que combinam com você. Venha conferir e aproveite seu cashback de 5%! 🚀' },
  em_risco:         { label:'Em Risco',          emoji:'⚠️', cor:'#ffb340', cashbackSugerido:7,  msg:'{nome}, sentimos sua falta na {loja}! Preparamos uma oferta especial só para você: cashback de 7% + condições exclusivas. Válido por 48h! ⚠️' },
  precisa_atencao:  { label:'Precisa Atenção',   emoji:'👀', cor:'#ef9f27', cashbackSugerido:6,  msg:'Oi {nome}! Faz tempo que não te vemos na {loja}. Que tal uma visita? Seu cashback de 6% está esperando por você! 👀' },
  nao_pode_perder:  { label:'Não Pode Perder',   emoji:'🆘', cor:'#f09595', cashbackSugerido:10, msg:'{nome}, você é muito importante para nós na {loja}! Por isso estamos oferecendo 10% de cashback exclusivo para você voltar. Fala com a gente! 🆘' },
  hibernando:       { label:'Hibernando',        emoji:'😴', cor:'#e24b4a', cashbackSugerido:8,  msg:'Sentimos muito a sua falta, {nome}! A {loja} tem muita novidade desde sua última visita. Volte e ganhe 8% de cashback! 😴' },
  perdido:          { label:'Perdidos',          emoji:'💀', cor:'#a32d2d', cashbackSugerido:10, msg:'{nome}, última tentativa: 10% de cashback exclusivo esperando por você na {loja}. Oferta por tempo limitado! 💀' }
}
