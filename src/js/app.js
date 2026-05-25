/**
 * app.js — Controller principal do CashFlow
 * Conecta store ↔ UI ↔ almode.js
 */

import * as Almode from './almode.js'
import { getState, setState, subscribe, loadConfig, saveConfig, loadClientes, saveClientes, getStats } from './store.js'

// ─── Boot ─────────────────────────────────────────────────────────────────────
export function boot() {
  loadConfig()
  loadClientes()

  const { config } = getState()
  Almode.setConfig(config)

  // Preenche inputs de config com valores salvos
  _fillConfigInputs(config)

  // Renderiza estado inicial
  renderStats()
  renderTable(getState().clientes)
  updateBadge()

  // Reage a mudanças de estado
  subscribe(state => {
    renderStats()
    updateBadge()
  })

  // Atalho de teclado: F2 abre popup (se disponível no Electron)
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') openPopup()
  })

  log('CashFlow inicializado', 'ok')
}

// ─── Configuração ─────────────────────────────────────────────────────────────
export function onSaveConfig() {
  const cfg = {
    domain: val('cfDomain').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    token: val('cfToken'),
    cnpj: val('cfCnpj').replace(/\D/g, ''),
    cashbackPct: parseFloat(val('cfPct')) || 5
  }
  saveConfig(cfg)
  Almode.setConfig(cfg)
  updateBadge()
  toast('✓ Configuração salva')
}

// ─── Conexão ──────────────────────────────────────────────────────────────────
export async function onTestConexao() {
  setText('syncStatus', 'Testando conexão...')
  log('Testando conexão com Almode API...')
  try {
    await Almode.testarConexao()
    setText('syncStatus', 'Conexão OK ✓')
    log('Almode API respondendo', 'ok')
    toast('✓ Almode conectado!')
  } catch (e) {
    setText('syncStatus', 'Erro de conexão')
    log('Erro: ' + e.message, 'err')
    toast('✗ ' + e.message, 'err')
  }
}

// ─── Sincronização ────────────────────────────────────────────────────────────
export async function onSync() {
  const { config } = getState()
  if (!config.domain || !config.token) { toast('Configure domínio e token', 'warn'); return }
  if (!config.cnpj) { toast('Configure o CNPJ da loja', 'warn'); return }

  setState({ syncStatus: 'syncing', syncProgress: 0, syncError: null })
  setDisabled('btnSync', true)
  show('progress')
  setText('syncStatus', 'Listando clientes...')
  log('Iniciando sincronização...')
  log(`Loja: ${config.cnpj}`)

  try {
    const clientes = await Almode.sincronizarTodosClientes((atual, total) => {
      const pct = Math.round((atual / total) * 100)
      setState({ syncProgress: pct })
      setProgress(pct)
      setText('syncStatus', `Buscando ${atual}/${total} clientes...`)
      log(`Processados: ${atual}/${total}`)
    })

    saveClientes(clientes)
    renderTable(clientes)
    const { total, comSaldo, totalCashback } = getStats()
    log(`Sincronização concluída: ${total} clientes, ${comSaldo} com saldo`, 'ok')
    log(`Total cashback disponível: R$ ${totalCashback.toFixed(2)}`, 'ok')
    toast(`✓ ${total} clientes sincronizados!`)
    setText('syncStatus', `${total} clientes · última sync: agora`)
  } catch (e) {
    setState({ syncStatus: 'error', syncError: e.message })
    log('Erro na sincronização: ' + e.message, 'err')
    toast('✗ ' + e.message, 'err')
    setText('syncStatus', 'Erro — veja o log')
  }

  setDisabled('btnSync', false)
  hide('progress')
}

// ─── Consulta por CPF (popup) ─────────────────────────────────────────────────
export async function onConsultar(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  if (cpfLimpo.length < 11) return { erro: 'CPF inválido' }

  // Primeiro busca local (rápido)
  const { clientes, config } = getState()
  const local = clientes.find(c => c.cpf.replace(/\D/g, '') === cpfLimpo)
  if (local) return { cliente: local }

  // Fallback: consulta API em tempo real
  if (!config.domain || !config.token) return { erro: 'API não configurada' }
  try {
    const cliente = await Almode.buscarClientePorCpf(cpfLimpo)
    if (!cliente) return { erro: 'Cliente não encontrado' }
    return { cliente }
  } catch (e) {
    return { erro: e.message }
  }
}

// ─── Tabela ───────────────────────────────────────────────────────────────────
export function renderTable(data) {
  const tbody = document.getElementById('clientsTbody')
  if (!tbody) return
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--color-text-secondary)">
      Sincronize para ver os dados
    </td></tr>`
    return
  }
  tbody.innerHTML = data.map(c => {
    const saldo = c.cashback || 0
    const temSaldo = saldo > 0
    return `<tr class="tr-hover">
      <td>${esc(c.nome)}</td>
      <td class="mono">${fmtCpf(c.cpf)}</td>
      <td class="${temSaldo ? 'val-green' : 'val-muted'}">R$ ${saldo.toFixed(2).replace('.', ',')}</td>
      <td class="mono">${esc(c.telefone || '—')}</td>
      <td><span class="chip ${temSaldo ? 'chip-green' : 'chip-gray'}">${temSaldo ? 'Com saldo' : 'Zerado'}</span></td>
    </tr>`
  }).join('')
}

export function filterTable(q) {
  const { clientes } = getState()
  const term = q.toLowerCase()
  renderTable(clientes.filter(c =>
    c.nome.toLowerCase().includes(term) ||
    c.cpf.replace(/\D/g, '').includes(term.replace(/\D/g, ''))
  ))
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function renderStats() {
  const { total, comSaldo, totalCashback } = getStats()
  const { clientes, syncLastAt } = getState()
  setText('sTotal', total || '—')
  setText('sComSaldo', comSaldo || '—')
  setText('sTotalCashback', total ? 'R$ ' + totalCashback.toFixed(2).replace('.', ',') : '—')
  setText('sLastSync', syncLastAt ? syncLastAt.toLocaleTimeString('pt-BR') : '—')
}

function updateBadge() {
  const { config } = getState()
  const el = document.getElementById('apiBadge')
  if (!el) return
  if (config.domain && config.token) {
    el.textContent = config.domain
    el.dataset.live = 'true'
  } else {
    el.textContent = 'API: configurar'
    el.dataset.live = 'false'
  }
}

// ─── Popup ────────────────────────────────────────────────────────────────────
export function openPopup() {
  // No Electron: usa IPC
  if (window.cashflowApp) {
    window.cashflowApp.openPopup()
    return
  }
  // Fallback: abre em janela pequena do navegador
  window.open('popup-vendedor.html', 'cashflow-popup',
    'width=440,height=580,resizable=no,alwaysOnTop=yes')
}

// ─── Log ──────────────────────────────────────────────────────────────────────
export function log(msg, type = 'info') {
  const wrap = document.getElementById('logWrap')
  if (!wrap) return
  const t = new Date().toLocaleTimeString('pt-BR')
  const cls = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : type === 'warn' ? 'log-warn' : ''
  const row = document.createElement('div')
  row.className = 'log-row'
  row.innerHTML = `<span class="log-t">${t}</span><span class="${cls}">${esc(msg)}</span>`
  wrap.appendChild(row)
  wrap.scrollTop = wrap.scrollHeight
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = 'toast toast-' + type + ' toast-show'
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.remove('toast-show'), 3200)
}

// ─── Utilitários DOM ──────────────────────────────────────────────────────────
const val = id => (document.getElementById(id) || {}).value || ''
const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t }
const setDisabled = (id, v) => { const el = document.getElementById(id); if (el) el.disabled = v }
const show = id => { const el = document.getElementById(id); if (el) el.style.display = '' }
const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none' }
const setProgress = pct => { const el = document.getElementById('progressBar'); if (el) el.style.width = pct + '%' }
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

function fmtCpf(v) {
  const d = (v || '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}

function _fillConfigInputs(cfg) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || '' }
  set('cfDomain', cfg.domain)
  set('cfToken', cfg.token)
  set('cfCnpj', cfg.cnpj)
  set('cfPct', cfg.cashbackPct || 5)
}
