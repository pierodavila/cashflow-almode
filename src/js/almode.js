/**
 * ╔══════════════════════════════════════════╗
 * ║  almode.js — Módulo de Integração API    ║
 * ║  CashFlow v2                             ║
 * ╚══════════════════════════════════════════╝
 *
 * Este arquivo é o único ponto de contato com a API do Almode.
 * Toda a lógica de negócio e UI depende APENAS das funções exportadas aqui.
 * Para conectar o agente: preencha as funções abaixo com as chamadas reais.
 *
 * Endpoints utilizados (API Pública Almode):
 *   GET /api/public/clientes?busca={cpf}
 *   GET /api/public/clientes/resumido-por-loja?cnpjLoja={cnpj}&atualizadosApartirDe={data}
 *   GET /api/public/clientes/tipos
 *   (Seção Cashback nativa — a ser mapeada pelo agente)
 *
 * Auth: Bearer Token no header Authorization
 */

// ─── Configuração (preenchida pelo usuário no app) ────────────────────────────
let _config = {
  domain: '',   // ex: "suaempresa.almode.dev"
  token: '',    // Bearer token do admin
  cnpj: '',     // CNPJ da loja (só números)
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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Almode API ${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Testa a conexão com a API.
 * @returns {Promise<boolean>}
 */
export async function testarConexao() {
  await http('/api/public/clientes/tipos')
  return true
}

/**
 * Busca um cliente pelo CPF.
 * Retorna os dados completos incluindo disponivelEmCashback.
 *
 * @param {string} cpf — apenas números
 * @returns {Promise<Cliente|null>}
 *
 * @typedef {Object} Cliente
 * @property {string} cnpjOuCpf
 * @property {string} razaoSocialOuNome
 * @property {number} disponivelEmCashback
 * @property {number} disponivelEmCredito
 * @property {string[]} telefones
 * @property {string|null} email
 */
export async function buscarClientePorCpf(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  const data = await http(`/api/public/clientes?busca=${cpfLimpo}`)
  const content = data.content || data || []
  const cliente = Array.isArray(content) ? content[0] : content
  if (!cliente || !cliente.cnpjOuCpf) return null
  return normalizarCliente(cliente)
}

/**
 * Lista todos os clientes da loja (sincronização completa ou incremental).
 *
 * @param {string|null} atualizadosApartirDe — ISO datetime, ex: "2025-01-01T00:00:00"
 * @returns {Promise<ClienteResumido[]>}
 *
 * @typedef {Object} ClienteResumido
 * @property {string} cnpjOuCpf
 * @property {string} razaoSocialOuNome
 * @property {string[]} telefones
 * @property {boolean} inativo
 */
export async function listarClientesDaLoja(atualizadosApartirDe = null) {
  if (!_config.cnpj) throw new Error('Configure o CNPJ da loja')
  let path = `/api/public/clientes/resumido-por-loja?cnpjLoja=${_config.cnpj}`
  if (atualizadosApartirDe) {
    path += `&atualizadosApartirDe=${encodeURIComponent(atualizadosApartirDe)}`
  }
  const data = await http(path)
  const lista = Array.isArray(data) ? data : (data.content || [])
  return lista.filter(c => !c.inativo)
}

/**
 * Sincronização completa: lista todos os clientes e busca detalhes de cashback.
 * Retorna um array com os dados enriquecidos.
 *
 * @param {function} onProgress — callback (atual, total) para atualizar barra
 * @returns {Promise<Cliente[]>}
 */
export async function sincronizarTodosClientes(onProgress = null) {
  const resumidos = await listarClientesDaLoja()
  const total = resumidos.length
  const resultado = []

  // Busca em lotes de 10 para não sobrecarregar a API
  const LOTE = 10
  for (let i = 0; i < total; i += LOTE) {
    const lote = resumidos.slice(i, i + LOTE)
    const detalhes = await Promise.allSettled(
      lote.map(c => buscarClientePorCpf(c.cnpjOuCpf))
    )
    detalhes.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        resultado.push(r.value)
      } else {
        // fallback com dados resumidos
        resultado.push(normalizarClienteResumido(lote[idx]))
      }
    })
    if (onProgress) onProgress(Math.min(i + LOTE, total), total)
  }

  return resultado
}

// ─── STUB: Cashback nativo Almode ─────────────────────────────────────────────
/**
 * ⚡ ÁREA DO AGENTE
 *
 * O Almode tem uma seção "Cashback" nativa na API.
 * O agente vai mapear os endpoints reais e preencher estas funções.
 *
 * Por enquanto o cashback é lido via disponivelEmCashback no endpoint de cliente.
 */

/**
 * [STUB] Lança cashback para um cliente.
 * A ser implementado pelo agente após mapear os endpoints.
 *
 * @param {string} cpf
 * @param {number} valor
 * @returns {Promise<boolean>}
 */
export async function lancarCashback(cpf, valor) {
  // TODO: implementar após agente mapear endpoint de cashback
  console.warn('[almode.js] lancarCashback ainda não implementado. CPF:', cpf, 'Valor:', valor)
  throw new Error('Lançamento de cashback ainda não configurado. Aguarde integração do agente.')
}

/**
 * [STUB] Resgata (queima) cashback de um cliente.
 *
 * @param {string} cpf
 * @param {number} valor
 * @returns {Promise<boolean>}
 */
export async function resgatar(cpf, valor) {
  // TODO: implementar após agente mapear endpoint de cashback
  console.warn('[almode.js] resgatar ainda não implementado.')
  throw new Error('Resgate de cashback ainda não configurado. Aguarde integração do agente.')
}

// ─── Normalização ─────────────────────────────────────────────────────────────
function normalizarCliente(raw) {
  return {
    cpf: raw.cnpjOuCpf || '',
    nome: raw.razaoSocialOuNome || '',
    cashback: parseFloat(raw.disponivelEmCashback) || 0,
    credito: parseFloat(raw.disponivelEmCredito) || 0,
    telefone: (raw.telefones || [])[0] || '',
    email: raw.email || '',
    inativo: raw.inativo || false,
    _raw: raw
  }
}

function normalizarClienteResumido(raw) {
  return {
    cpf: raw.cnpjOuCpf || '',
    nome: raw.razaoSocialOuNome || '',
    cashback: 0,
    credito: 0,
    telefone: (raw.telefones || [])[0] || '',
    email: '',
    inativo: raw.inativo || false
  }
}
