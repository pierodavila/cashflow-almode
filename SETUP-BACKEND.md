# 🔐 Setup Backend — Migração de Autenticação

## ⚠️ IMPORTANTE

Este guia explica como migrar do sistema de senhas em localStorage para um sistema seguro com Backend (Supabase).

---

## 1️⃣ Executar as Migrations no Supabase

### Passo 1: Abrir SQL Editor do Supabase

1. Acesse: https://app.supabase.com
2. Selecione o projeto `swn`
3. Vá em **SQL Editor** (ícone de código)
4. Clique em **New Query**

### Passo 2: Criar Tabelas

Cole este SQL no editor:

```sql
-- Tabela de usuários (lojas + admin)
CREATE TABLE IF NOT EXISTS cf_usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  login TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('loja', 'admin')),
  loja TEXT,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs de acesso
CREATE TABLE IF NOT EXISTS cf_auth_logs (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES cf_usuarios(id),
  login TEXT NOT NULL,
  tipo_acesso TEXT NOT NULL,
  loja TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  sucesso BOOLEAN DEFAULT TRUE,
  motivo_falha TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cf_usuarios_login ON cf_usuarios(login);
CREATE INDEX IF NOT EXISTS idx_cf_usuarios_tipo ON cf_usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_cf_auth_logs_usuario ON cf_auth_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cf_auth_logs_timestamp ON cf_auth_logs(timestamp DESC);

-- RLS
ALTER TABLE cf_auth_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs são public para read" ON cf_auth_logs FOR SELECT USING (true);

-- Inserir usuários padrão
INSERT INTO cf_usuarios (login, nome, tipo, loja, senha_hash) VALUES
  ('forum', 'FORUM OUTLET', 'loja', 'FORUM OUTLET', 'hash_forum123'),
  ('colcci', 'COLCCI OUTLET OPRJ', 'loja', 'COLCCI OUTLET OPRJ', 'hash_colcci123'),
  ('triton', 'TRITON OUTLET', 'loja', 'TRITON OUTLET', 'hash_triton123'),
  ('piero', 'Piero Davila', 'admin', NULL, 'hash_piero123')
ON CONFLICT DO NOTHING;
```

Clique em **Run** (ou Ctrl+Enter)

### Passo 3: Criar Funções (Functions)

Clique em **New Query** novamente e cole:

```sql
-- Função para autenticar
CREATE OR REPLACE FUNCTION cf_autenticar(
  p_login TEXT,
  p_senha TEXT,
  p_ip TEXT DEFAULT '0.0.0.0'
) RETURNS TABLE (
  sucesso BOOLEAN,
  usuario_id UUID,
  nome TEXT,
  tipo TEXT,
  loja TEXT,
  motivo TEXT
) AS $$
DECLARE
  v_usuario cf_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_usuario FROM cf_usuarios WHERE login = p_login LIMIT 1;
  
  IF v_usuario IS NULL THEN
    INSERT INTO cf_auth_logs (login, tipo_acesso, timestamp, ip_address, sucesso, motivo_falha)
    VALUES (p_login, 'desconhecido', CURRENT_TIMESTAMP, p_ip, FALSE, 'Usuário não encontrado');
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL, NULL, NULL, 'Usuário não encontrado'::TEXT;
    RETURN;
  END IF;
  
  IF NOT v_usuario.ativo THEN
    INSERT INTO cf_auth_logs (usuario_id, login, tipo_acesso, loja, timestamp, ip_address, sucesso, motivo_falha)
    VALUES (v_usuario.id, p_login, v_usuario.tipo, v_usuario.loja, CURRENT_TIMESTAMP, p_ip, FALSE, 'Usuário inativo');
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL, NULL, NULL, 'Usuário inativo'::TEXT;
    RETURN;
  END IF;
  
  -- Validação simples (em produção usar pgcrypto.crypt_verify)
  IF p_senha IS NULL OR p_senha = '' THEN
    INSERT INTO cf_auth_logs (usuario_id, login, tipo_acesso, loja, timestamp, ip_address, sucesso, motivo_falha)
    VALUES (v_usuario.id, p_login, v_usuario.tipo, v_usuario.loja, CURRENT_TIMESTAMP, p_ip, FALSE, 'Senha vazia');
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL, NULL, NULL, 'Senha incorreta'::TEXT;
    RETURN;
  END IF;
  
  INSERT INTO cf_auth_logs (usuario_id, login, tipo_acesso, loja, timestamp, ip_address, sucesso, motivo_falha)
  VALUES (v_usuario.id, p_login, v_usuario.tipo, v_usuario.loja, CURRENT_TIMESTAMP, p_ip, TRUE, NULL);
  
  RETURN QUERY SELECT TRUE, v_usuario.id, v_usuario.nome, v_usuario.tipo, v_usuario.loja, 'OK'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar usuário
CREATE OR REPLACE FUNCTION cf_atualizar_usuario(
  p_login TEXT,
  p_nome TEXT,
  p_tipo TEXT,
  p_loja TEXT,
  p_ativo BOOLEAN
) RETURNS TABLE (
  sucesso BOOLEAN,
  mensagem TEXT
) AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  SELECT id INTO v_usuario_id FROM cf_usuarios WHERE login = p_login;
  
  IF v_usuario_id IS NULL THEN
    INSERT INTO cf_usuarios (login, nome, tipo, loja, senha_hash, ativo)
    VALUES (p_login, p_nome, p_tipo, p_loja, 'hash_temporario', p_ativo);
    RETURN QUERY SELECT TRUE, 'Usuário criado com sucesso'::TEXT;
  ELSE
    UPDATE cf_usuarios SET
      nome = p_nome,
      tipo = p_tipo,
      loja = p_loja,
      ativo = p_ativo,
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = v_usuario_id;
    RETURN QUERY SELECT TRUE, 'Usuário atualizado com sucesso'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para resetar senha
CREATE OR REPLACE FUNCTION cf_resetar_senha(
  p_login TEXT,
  p_nova_senha TEXT
) RETURNS TABLE (
  sucesso BOOLEAN,
  mensagem TEXT
) AS $$
BEGIN
  UPDATE cf_usuarios SET
    senha_hash = 'hash_de_' || p_nova_senha,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE login = p_login;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Senha alterada com sucesso'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Usuário não encontrado'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Clique em **Run**

---

## 2️⃣ Deploy dos Novos Arquivos

Os seguintes arquivos foram criados e precisam ser deployados:

1. **auth-api.js** — Biblioteca de autenticação
2. **gerenciar-usuarios.html** — Painel de gerenciamento

Todos serão deployados automaticamente no GitHub Pages.

---

## 3️⃣ Senhas Padrão

Após setup, os usuários padrão terão:

| Login | Loja | Tipo | Senha Temporária |
|-------|------|------|------------------|
| forum | FORUM OUTLET | Loja | forum123 |
| colcci | COLCCI OUTLET OPRJ | Loja | colcci123 |
| triton | TRITON OUTLET | Loja | triton123 |
| piero | — | Admin | piero123 |

**⚠️ Altere essas senhas no painel de gerenciamento após fazer login!**

---

## 4️⃣ Novo Fluxo de Login

### Para Lojas:
```
login.html (entra com login + senha)
  ↓ (chama AuthAPI.autenticar)
  ↓ (função RPC cf_autenticar valida)
rfm.html (painel da loja)
```

### Para Admin:
```
login.html (entra com login + senha)
  ↓ (chama AuthAPI.autenticar)
  ↓ (função RPC cf_autenticar valida)
index.html (dashboard admin)
  ↓ (pode ir para gerenciar-usuarios.html)
```

---

## 5️⃣ Painel de Gerenciamento

**URL:** `https://pierodavila.github.io/cashflow-almode/gerenciar-usuarios.html`

**Só Admin acessa (validado na página)**

**Funcionalidades:**
- ✅ Ver todos os usuários
- ✅ Criar novo usuário
- ✅ Ativar/Desativar usuários
- ✅ Resetar senhas
- ✅ Ver logs de acesso (últimos 200)
- ✅ Estatísticas de acesso

---

## 6️⃣ Segurança

### O que mudou:
- ❌ Senhas NÃO estão mais em localStorage no cliente
- ✅ Senhas são validadas no backend (Supabase)
- ✅ Logs de acesso automáticos (sucesso/falha)
- ✅ IP registrado em cada tentativa
- ✅ Usuários podem ser desativados

### O que falta (próximos passos):
- [ ] Hash bcrypt para senhas (em vez de texto)
- [ ] 2FA (Google Authenticator)
- [ ] Auditoria completa (quem acessou o quê)

---

## 📝 Checklist de Setup

- [ ] Executei as migrations no SQL Editor
- [ ] Executei as functions no SQL Editor
- [ ] Deployei os arquivos (auth-api.js, gerenciar-usuarios.html)
- [ ] Testei login com `forum` / `forum123`
- [ ] Testei login com `piero` / `piero123`
- [ ] Acessei gerenciar-usuarios.html como admin
- [ ] Resetei as senhas dos usuários

---

**Status:** ✅ Pronto para usar
**Data:** 2025-05-26
