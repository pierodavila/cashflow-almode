/**
 * store.js — Estado global da aplicação CashFlow
 * Estado reativo simples via callbacks (sem framework)
 */

const _state = {
  config: {
    domain: '',
    token: '',
    cnpj: '',
    cashbackPct: 5
  },
  clientes: [],           // Cliente[]
  syncStatus: 'idle',     // 'idle' | 'syncing' | 'done' | 'error'
  syncProgress: 0,        // 0-100
  syncLastAt: null,       // Date
  syncError: null,        // string | null
  activeSection: 'dashboard'
}

const _listeners = new Set()

export function getState() {
  return { ..._state, clientes: [..._state.clientes] }
}

export function setState(patch) {
  Object.assign(_state, patch)
  _listeners.forEach(fn => fn(getState()))
}

export function subscribe(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// ─── Config persistida no localStorage ───────────────────────────────────────
export function loadConfig() {
  try {
    const raw = localStorage.getItem('cf_config_v2')
    if (raw) {
      const cfg = JSON.parse(raw)
      setState({ config: { ..._state.config, ...cfg } })
    }
  } catch {}
}

export function saveConfig(cfg) {
  const next = { ..._state.config, ...cfg }
  setState({ config: next })
  try { localStorage.setItem('cf_config_v2', JSON.stringify(next)) } catch {}
}

// ─── Clientes persistidos ─────────────────────────────────────────────────────
export function loadClientes() {
  try {
    const raw = localStorage.getItem('cf_clientes_v2')
    if (raw) {
      const { clientes, syncLastAt } = JSON.parse(raw)
      setState({ clientes, syncLastAt: syncLastAt ? new Date(syncLastAt) : null })
    }
  } catch {}
}

export function saveClientes(clientes) {
  setState({ clientes, syncLastAt: new Date(), syncStatus: 'done', syncProgress: 100 })
  try {
    localStorage.setItem('cf_clientes_v2', JSON.stringify({
      clientes,
      syncLastAt: new Date().toISOString()
    }))
  } catch {}
}

// ─── Seletores úteis ──────────────────────────────────────────────────────────
export function getStats() {
  const { clientes } = _state
  return {
    total: clientes.length,
    comSaldo: clientes.filter(c => c.cashback > 0).length,
    totalCashback: clientes.reduce((s, c) => s + (c.cashback || 0), 0),
    mediaCompra: 0   // será calculado quando tivermos dados de venda
  }
}
