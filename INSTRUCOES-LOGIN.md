# 🔐 Sistema de Login CashFlow

## Resumo

Implementado sistema de autenticação com dois níveis de acesso:
1. **Gerentes de Loja** - acesso restrito ao RFM e mensagens
2. **Admin (Piero)** - acesso total ao sistema

---

## 🔑 Credenciais

### Lojas
| Loja | Senha |
|------|-------|
| FORUM OUTLET | `forum123` |
| COLCCI OUTLET OPRJ | `colcci123` |
| TRITON OUTLET | `triton123` |

### Admin
| Usuário | Senha |
|---------|-------|
| Admin (Piero) | `piero123` |

---

## 📍 URLs

**Página de Login:** https://pierodavila.github.io/cashflow-almode/login.html

- Gerente de Loja verá RFM + Painel de Mensagens
- Admin verá Dashboard + Todas as ferramentas

---

## 🎯 O que cada nível acessa

### 👤 Gerente de Loja

**Tela 1: Painel RFM** (`rfm.html?loja=FORUM_OUTLET`)
- Ver clientes da própria loja
- Segmentação RFM (Campeões, Leais, etc)
- Filtros por segmento
- Exportar lista em Excel
- Botão "Voltar" para ir ao painel de mensagens

**Tela 2: Painel de Mensagens** (`painel-loja.html`)
- Ver lista de clientes da loja
- Filtrar por segmento RFM
- Enviar WhatsApp manual por cliente
- Contador de "Contatados hoje"
- Exportar lista

### 👑 Admin (Você)

Acesso total a:
- ✅ Dashboard principal
- ✅ Painel RFM (todas as lojas)
- ✅ Painel de Vendedores
- ✅ Campanhas SMS/WhatsApp
- ✅ Pop-up do Caixa
- ✅ Sincronização manual
- ✅ Importar dados
- ✅ Configurações

---

## 🔄 Fluxo de Login

### Para Gerente de Loja
```
login.html
  ↓ (seleciona loja + senha)
rfm.html (RFM da loja)
  ↓ (clica "Voltar")
painel-loja.html (mensagens)
  ↓ (clica "Sair")
login.html (logout)
```

### Para Admin
```
login.html
  ↓ (seleciona Admin + senha)
index.html (Dashboard admin)
  ↓ (menu lateral para outras páginas)
...
  ↓ (clica "Sair" no topo)
login.html (logout)
```

---

## 🔒 Segurança

- Senhas armazenadas em localStorage (considere usar backend depois)
- Cada página valida autenticação no carregamento
- Logout limpa dados de sessão
- Sessão rastreada por token timestamp

---

## 📝 Alterações Feitas

1. ✅ Criado `login.html` - página de login com 2 formulários
2. ✅ Atualizado `index.html` - exige autenticação admin
3. ✅ Atualizado `rfm.html` - filtra por loja + exibe nome
4. ✅ Atualizado `painel-loja.html` - auto-preenche loja da sessão
5. ✅ Script `auth` adicionado a todos (check + logout)

---

## 🛠️ Como Alterar Senhas

Edite `login.html` e mude:

```javascript
// Linha ~120
const senhas = {
  'FORUM OUTLET': 'nova-senha-forum',
  'COLCCI OUTLET OPRJ': 'nova-senha-colcci',
  'TRITON OUTLET': 'nova-senha-triton'
}

// Linha ~125
const senhaAdmin = 'nova-senha-admin'
```

---

## 📱 Próximos Passos Opcionais

- [ ] Migrar senhas para backend (API segura)
- [ ] Adicionar 2FA (autenticação de dois fatores)
- [ ] Log de acesso e ações dos usuários
- [ ] Painel de gerenciamento de usuários/senhas

---

**Status:** ✅ Implementado e testado
**Data:** 2025-05-26
**Versão:** 1.0
