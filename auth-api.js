// ============================================
// Autenticação com Supabase (Backend)
// ============================================

const SB_URL = 'https://gudhgyfaizueshafhqvc.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZGhneWZhaXp1ZXNoYWZocXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODgzNDksImV4cCI6MjA5NTI2NDM0OX0.LrUMZ6XnQFqvmDMn1n5vkdS5FIgTY8j-tnsMH_dtA08'

// Obter IP do usuário (aproximado)
async function obterIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json')
    const data = await r.json()
    return data.ip
  } catch {
    return '0.0.0.0'
  }
}

// ============================================
// Autenticação
// ============================================

const AuthAPI = {
  /**
   * Autentica um usuário (loja ou admin)
   */
  async autenticar(login, senha) {
    const ip = await obterIP()
    
    try {
      // Chama a função RPC do Supabase
      const response = await fetch(`${SB_URL}/rest/v1/rpc/cf_autenticar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        },
        body: JSON.stringify({
          p_login: login,
          p_senha: senha,
          p_ip: ip
        })
      })
      
      if (!response.ok) {
        console.error('Erro na autenticação:', response.statusText)
        return { sucesso: false, motivo: 'Erro de conexão' }
      }
      
      const resultado = await response.json()
      
      // A resposta é um array com um objeto
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return { sucesso: false, motivo: 'Resposta inválida' }
      }
      
      const auth = resultado[0]
      
      if (!auth.sucesso) {
        return { sucesso: false, motivo: auth.motivo }
      }
      
      // Salva na sessão (localStorage)
      localStorage.setItem('cf_auth_tipo', auth.tipo)
      localStorage.setItem('cf_auth_loja', auth.loja || '')
      localStorage.setItem('cf_auth_usuario_id', auth.usuario_id)
      localStorage.setItem('cf_auth_nome', auth.nome)
      localStorage.setItem('cf_auth_token', Date.now().toString())
      
      return { sucesso: true, ...auth }
    } catch (err) {
      console.error('Erro ao autenticar:', err)
      return { sucesso: false, motivo: 'Erro de conexão' }
    }
  },

  /**
   * Logout
   */
  logout() {
    localStorage.removeItem('cf_auth_tipo')
    localStorage.removeItem('cf_auth_loja')
    localStorage.removeItem('cf_auth_usuario_id')
    localStorage.removeItem('cf_auth_nome')
    localStorage.removeItem('cf_auth_token')
  },

  /**
   * Obtém dados da sessão atual
   */
  getUsuarioAtual() {
    return {
      tipo: localStorage.getItem('cf_auth_tipo'),
      loja: localStorage.getItem('cf_auth_loja'),
      usuario_id: localStorage.getItem('cf_auth_usuario_id'),
      nome: localStorage.getItem('cf_auth_nome')
    }
  },

  /**
   * Valida autenticação
   */
  check(requireAdmin = false) {
    const usuario = this.getUsuarioAtual()
    
    if (!usuario.tipo || !usuario.usuario_id) {
      return false
    }
    
    if (requireAdmin && usuario.tipo !== 'admin') {
      return false
    }
    
    return usuario
  }
}

// ============================================
// Gerenciamento de Usuários (Admin)
// ============================================

const UsuariosAPI = {
  /**
   * Lista todos os usuários
   */
  async listar() {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/cf_usuarios?select=*&order=criado_em.desc`, {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        }
      })
      
      if (!r.ok) return { sucesso: false, usuarios: [] }
      return { sucesso: true, usuarios: await r.json() }
    } catch (err) {
      console.error('Erro ao listar usuários:', err)
      return { sucesso: false, usuarios: [] }
    }
  },

  /**
   * Cria ou atualiza um usuário
   */
  async salvar(login, nome, tipo, loja, ativo) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/cf_atualizar_usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        },
        body: JSON.stringify({
          p_login: login,
          p_nome: nome,
          p_tipo: tipo,
          p_loja: loja,
          p_ativo: ativo
        })
      })
      
      const resultado = await r.json()
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return { sucesso: false }
      }
      
      return resultado[0]
    } catch (err) {
      console.error('Erro ao salvar usuário:', err)
      return { sucesso: false }
    }
  },

  /**
   * Deleta um usuário
   */
  async deletar(login) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/cf_usuarios?login=eq.${encodeURIComponent(login)}`, {
        method: 'DELETE',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        }
      })
      
      return r.ok
    } catch (err) {
      console.error('Erro ao deletar usuário:', err)
      return false
    }
  },

  /**
   * Reseta senha de um usuário
   */
  async resetarSenha(login, novaSenha) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/cf_resetar_senha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        },
        body: JSON.stringify({
          p_login: login,
          p_nova_senha: novaSenha
        })
      })
      
      const resultado = await r.json()
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return { sucesso: false }
      }
      
      return resultado[0]
    } catch (err) {
      console.error('Erro ao resetar senha:', err)
      return { sucesso: false }
    }
  }
}

// ============================================
// Logs de Acesso
// ============================================

const LogsAPI = {
  /**
   * Obtém logs de acesso
   */
  async listar(limit = 100) {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/cf_auth_logs?select=*&order=timestamp.desc&limit=${limit}`,
        {
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`
          }
        }
      )
      
      if (!r.ok) return { sucesso: false, logs: [] }
      
      const logs = await r.json()
      
      // Formata datas
      return {
        sucesso: true,
        logs: logs.map(log => ({
          ...log,
          timestamp_fmt: new Date(log.timestamp).toLocaleString('pt-BR'),
          sucesso_txt: log.sucesso ? '✅ OK' : '❌ Falhou'
        }))
      }
    } catch (err) {
      console.error('Erro ao listar logs:', err)
      return { sucesso: false, logs: [] }
    }
  },

  /**
   * Obtém logs de um usuário específico
   */
  async porUsuario(usuarioId, limit = 50) {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/cf_auth_logs?usuario_id=eq.${usuarioId}&select=*&order=timestamp.desc&limit=${limit}`,
        {
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`
          }
        }
      )
      
      if (!r.ok) return { sucesso: false, logs: [] }
      
      const logs = await r.json()
      
      return {
        sucesso: true,
        logs: logs.map(log => ({
          ...log,
          timestamp_fmt: new Date(log.timestamp).toLocaleString('pt-BR'),
          sucesso_txt: log.sucesso ? '✅ OK' : '❌ Falhou'
        }))
      }
    } catch (err) {
      console.error('Erro ao listar logs:', err)
      return { sucesso: false, logs: [] }
    }
  },

  /**
   * Estatísticas de acesso
   */
  async stats() {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/cf_auth_logs?select=*`, {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        }
      })
      
      if (!r.ok) return { sucesso: false }
      
      const logs = await r.json()
      
      // Calcula stats
      const sucessos = logs.filter(l => l.sucesso).length
      const falhas = logs.filter(l => !l.sucesso).length
      
      const porTipo = {}
      logs.forEach(log => {
        porTipo[log.tipo_acesso] = (porTipo[log.tipo_acesso] || 0) + 1
      })
      
      return {
        sucesso: true,
        totalAcessos: logs.length,
        sucessos,
        falhas,
        taxaSucesso: logs.length > 0 ? (sucessos / logs.length * 100).toFixed(1) : 0,
        porTipo
      }
    } catch (err) {
      console.error('Erro ao calcular stats:', err)
      return { sucesso: false }
    }
  }
}

// Exportar para uso global
window.AuthAPI = AuthAPI
window.UsuariosAPI = UsuariosAPI
window.LogsAPI = LogsAPI

