/**
 * ╔══════════════════════════════════════════╗
 * ║  almode.js — Integração API Real         ║
 * ║  CashFlow v2 · Mapeado em 25/05/2026     ║
 * ╚══════════════════════════════════════════╝
 *
 * Endpoint base: https://{dominio}/api/vendas
 * Auth: JWT_TOKEN do localStorage (mesmo token do painel)
 *
 * Campos mapeados:
 *   cpfDoCliente         → CPF do cliente
 *   cliente.razaoSocialOuNome → nome
 *   pagamentos[].valor   → valor da venda (soma)
 *   situacao             → filtrar só "Concluida"
 *   dataHora             → data/hora da venda
 *   pontoDeVenda.loja    → loja
 */

let _config = {
  domain: '',
  token: '',
  cnpj: '',
  cashbackPct: 5
}

export function setConfig(cfg) {
  _config = { ..._config, ...cfg }
}

export function getConfig() {
  return { ..._config }
}

// ─── Helper HTTP ──────────────────────────────────────────────────────────────
async function http(path) {
  if (!_config.domain || !_config.token) {
    throw new Error('Configure domínio e token antes de usar a API')
  }
  const url = `https://${_config.domain}${path}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${_config.token}`,
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok) throw new Error(`Almode API ${res.status}`)
  return res.json()
}

// ─── Testa conexão ────────────────────────────────────────────────────────────
export async function testarConexao() {
  const data = await http('/api/vendas?page=0&size=1')
  return { ok: true, totalVendas: data.totalElements }
}

// ─── Busca cliente por CPF ────────────────────────────────────────────────────
export async function buscarClientePorCpf(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  // Filtra vendas por CPF para montar o perfil do cliente
  const data = await http(`/api/vendas?page=0&size=1&cpf=${cpfLimpo}`)
  const vendas = data.content || []
  if (!vendas.length) return null
  const v = vendas[0]
  const total = somarPagamentos(v.pagamentos)
  return {
    cpf: v.cpfDoCliente || cpfLimpo,
    nome: v.cliente?.razaoSocialOuNome || '—',
    cashback: 0, // calculado na sincronização
    telefone: (v.cliente?.telefones || [])[0] || '',
    email: v.cliente?.email || ''
  }
}

// ─── Busca TODAS as vendas (paginado) ─────────────────────────────────────────
export async function buscarTodasVendas(onProgress = null) {
  const PAGE_SIZE = 50
  const primeira = await http(`/api/vendas?page=0&size=${PAGE_SIZE}`)
  const totalPaginas = primeira.totalPages
  const totalVendas = primeira.totalElements

  let todasVendas = [...(primeira.content || [])]
  if (onProgress) onProgress(todasVendas.length, totalVendas)

  // Busca restante em paralelo (lotes de 5 páginas)
  for (let p = 1; p < totalPaginas; p += 5) {
    const lote = []
    for (let i = p; i < Math.min(p + 5, totalPaginas); i++) {
      lote.push(http(`/api/vendas?page=${i}&size=${PAGE_SIZE}`))
    }
    const resultados = await Promise.allSettled(lote)
    resultados.forEach(r => {
      if (r.status === 'fulfilled') {
        todasVendas = todasVendas.concat(r.value.content || [])
      }
    })
    if (onProgress) onProgress(Math.min(todasVendas.length, totalVendas), totalVendas)
  }

  return todasVendas
}

// ─── Sincronização completa ───────────────────────────────────────────────────
export async function sincronizarTodosClientes(onProgress = null) {
  const vendas = await buscarTodasVendas(onProgress)

  // Agrupa por CPF e calcula cashback
  const mapa = {}
  for (const v of vendas) {
    // Só considera vendas concluídas
    if (v.situacao !== 'Concluida') continue

    const cpf = v.cpfDoCliente || v.cliente?.cnpjOuCpf
    if (!cpf || cpf.length < 11) continue

    const nome = v.cliente?.razaoSocialOuNome || '—'
    const valor = somarPagamentos(v.pagamentos)
    if (valor <= 0) continue

    if (!mapa[cpf]) {
      mapa[cpf] = {
        cpf,
        nome,
        telefone: (v.cliente?.telefones || [])[0] || '',
        email: v.cliente?.email || '',
        totalCompras: 0,
        cashback: 0,
        qtdVendas: 0
      }
    }

    mapa[cpf].totalCompras += valor
    mapa[cpf].cashback += valor * (_config.cashbackPct / 100)
    mapa[cpf].qtdVendas++
    // Mantém nome mais recente
    if (nome !== '—') mapa[cpf].nome = nome
  }

  return Object.values(mapa).sort((a, b) => b.cashback - a.cashback)
}

// ─── Utilitários ─────────────────────────────────────────────────────────────
function somarPagamentos(pagamentos = []) {
  return pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0)
}

export function fmtCpf(v) {
  const d = (v || '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}
