/**
 * db.js — Camada de dados Supabase
 * CashFlow v2
 *
 * Substitui localStorage por Supabase.
 * Mantém fallback local para operações offline.
 */

let _supabase = null
let _cfg = {}

// ─── Inicializa ──────────────────────────────────────────────────────────────
export function initDB(url, anonKey) {
  _cfg = { url, anonKey }
  localStorage.setItem('cf_supabase_cfg', JSON.stringify(_cfg))
}

export function loadDBConfig() {
  const raw = localStorage.getItem('cf_supabase_cfg')
  if (raw) { _cfg = JSON.parse(raw) }
  return _cfg
}

export function isConfigured() {
  return !!(_cfg.url && _cfg.anonKey)
}

// ─── Helper HTTP para Supabase REST API ──────────────────────────────────────
async function sb(path, options = {}) {
  if (!isConfigured()) throw new Error('Supabase não configurado')
  const url = `${_cfg.url}/rest/v1/${path}`
  const headers = {
    'apikey': _cfg.anonKey,
    'Authorization': `Bearer ${_cfg.anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...options.headers
  }
  const res = await fetch(url, { method: options.method || 'GET', headers, body: options.body })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Supabase HTTP ${res.status}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : []
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export async function getClientes({ loja, limit = 10000 } = {}) {
  let path = `cf_clientes?select=*&order=cashback.desc&limit=${limit}`
  if (loja) path += `&loja=eq.${encodeURIComponent(loja)}`
  return sb(path)
}

export async function getClientePorCpf(cpf) {
  const data = await sb(`cf_clientes?cpf=eq.${cpf}&select=*&limit=1`)
  return data[0] || null
}

export async function upsertCliente(c) {
  return sb('cf_clientes', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      cpf: c.cpf,
      nome: c.nome || '—',
      total_compras: c.totalCompras || 0,
      cashback: c.cashback || 0,
      total_resgatado: c.totalResgatado || 0,
      qtd_vendas: c.qtdVendas || 0,
      telefone: c.telefone || '',
      ultima_compra: c.ultimaCompra || '',
      loja: c.loja || '—',
      lojas: c.lojas || {}
    })
  })
}

export async function upsertClientesLote(clientes) {
  // Divide em lotes de 500 para não estorar o limite
  const LOTE = 500
  for (let i = 0; i < clientes.length; i += LOTE) {
    const lote = clientes.slice(i, i + LOTE).map(c => ({
      cpf: c.cpf,
      nome: c.nome || '—',
      total_compras: c.totalCompras || 0,
      cashback: c.cashback || 0,
      total_resgatado: c.totalResgatado || 0,
      qtd_vendas: c.qtdVendas || 0,
      telefone: c.telefone || '',
      ultima_compra: c.ultimaCompra || '',
      loja: c.loja || '—',
      lojas: c.lojas || {}
    }))
    await sb('cf_clientes', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify(lote)
    })
  }
}

export async function atualizarCashbackCliente(cpf, valorResgatado) {
  // Decrementa cashback e incrementa total_resgatado
  return sb(`cf_clientes?cpf=eq.${cpf}`, {
    method: 'PATCH',
    body: JSON.stringify({
      cashback: `cashback - ${valorResgatado}`,
      total_resgatado: `total_resgatado + ${valorResgatado}`
    })
  })
}

// ─── RESGATES ─────────────────────────────────────────────────────────────────
export async function inserirResgate(r) {
  return sb('cf_resgates', {
    method: 'POST',
    body: JSON.stringify({
      cpf: r.cpf,
      nome: r.nome,
      loja: r.loja,
      vendedor: r.vendedor,
      valor_resgatado: r.valorResgatado,
      saldo_antes: r.saldoAntes,
      saldo_depois: r.saldoDepois,
      valor_compra: r.valorCompra,
      created_at: r.data || new Date().toISOString()
    })
  })
}

export async function getResgatesHoje(loja) {
  const inicio = new Date(); inicio.setHours(0,0,0,0)
  let path = `cf_resgates?select=*&order=created_at.desc&created_at=gte.${inicio.toISOString()}`
  if (loja) path += `&loja=eq.${encodeURIComponent(loja)}`
  return sb(path)
}

export async function getResgates({ loja, dias = 30, limit = 500 } = {}) {
  const inicio = new Date(); inicio.setDate(inicio.getDate() - dias)
  let path = `cf_resgates?select=*&order=created_at.desc&created_at=gte.${inicio.toISOString()}&limit=${limit}`
  if (loja) path += `&loja=eq.${encodeURIComponent(loja)}`
  return sb(path)
}

// ─── CAMPANHAS ────────────────────────────────────────────────────────────────
export async function getCampanhas(limit = 100) {
  return sb(`cf_campanhas?select=*&order=created_at.desc&limit=${limit}`)
}

export async function inserirCampanha(c) {
  return sb('cf_campanhas', {
    method: 'POST',
    body: JSON.stringify({
      nome: c.nome,
      canais: c.canais,
      segmentos: c.segmentos,
      mensagem: c.mensagem,
      loja: c.loja,
      status: c.status || 'rascunho',
      enviados: c.enviados || 0,
      erros: c.erros || 0,
      agendado_para: c.data || null
    })
  })
}

export async function atualizarCampanha(id, updates) {
  return sb(`cf_campanhas?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
}

// ─── STATS para dashboard ─────────────────────────────────────────────────────
export async function getStats() {
  const [clientes, resgatesHoje] = await Promise.all([
    sb('clientes?select=total_compras,cashback,total_resgatado,loja'),
    getResgatesHoje()
  ])
  const totalClientes = clientes.length
  const totalCashback = clientes.reduce((s,c)=>s+(c.cashback||0),0)
  const totalResgatado = clientes.reduce((s,c)=>s+(c.total_resgatado||0),0)
  const totalCompras = clientes.reduce((s,c)=>s+(c.total_compras||0),0)
  const resgatesHojeTotal = resgatesHoje.reduce((s,r)=>s+(r.valor_resgatado||0),0)

  // Por loja
  const porLoja = {}
  for (const c of clientes) {
    const l = c.loja || '—'
    if (!porLoja[l]) porLoja[l] = { clientes:0, cashback:0, compras:0 }
    porLoja[l].clientes++
    porLoja[l].cashback += c.cashback || 0
    porLoja[l].compras += c.total_compras || 0
  }

  return { totalClientes, totalCashback, totalResgatado, totalCompras, resgatesHoje: resgatesHoje.length, resgatesHojeTotal, porLoja }
}

// ─── MIGRAÇÃO do localStorage ─────────────────────────────────────────────────
export async function migrarLocalStorage(onProgress) {
  const raw = localStorage.getItem('cf_clientes_v2')
  if (!raw) throw new Error('Nenhum dado no localStorage para migrar')

  const data = JSON.parse(raw)
  const clientes = data.clientes || data || []
  if (!clientes.length) throw new Error('Lista de clientes vazia')

  if (onProgress) onProgress(0, clientes.length, 'Iniciando migração...')

  const LOTE = 500
  for (let i = 0; i < clientes.length; i += LOTE) {
    const lote = clientes.slice(i, i + LOTE).map(c => ({
      cpf: c.cpf,
      nome: c.nome || '—',
      total_compras: c.totalCompras || 0,
      cashback: c.cashback || 0,
      total_resgatado: c.totalResgatado || 0,
      qtd_vendas: c.qtdVendas || 0,
      telefone: c.telefone || '',
      ultima_compra: c.ultimaCompra || '',
      loja: c.loja || '—',
      lojas: c.lojas || {}
    }))

    await sb('cf_clientes', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify(lote)
    })

    if (onProgress) onProgress(Math.min(i + LOTE, clientes.length), clientes.length, `Migrando clientes ${i+LOTE}/${clientes.length}...`)
    await new Promise(r => setTimeout(r, 100))
  }

  // Migra resgates se existirem
  const resgatesRaw = localStorage.getItem('cf_resgates')
  if (resgatesRaw) {
    const resgates = JSON.parse(resgatesRaw)
    if (resgates.length) {
      if (onProgress) onProgress(clientes.length, clientes.length, `Migrando ${resgates.length} resgates...`)
      const loteResgates = resgates.map(r => ({
        cpf: r.cpf,
        nome: r.nome,
        loja: r.loja,
        vendedor: r.vendedor,
        valor_resgatado: r.valorResgatado,
        saldo_antes: r.saldoAntes,
        saldo_depois: r.saldoDepois,
        valor_compra: r.valorCompra,
        created_at: r.data || new Date().toISOString()
      }))
      await sb('cf_resgates', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        prefer: 'return=minimal',
        body: JSON.stringify(loteResgates)
      })
    }
  }

  return { clientes: clientes.length }
}

// Exporta config global para uso em scripts inline
export { _cfg as cfg }
