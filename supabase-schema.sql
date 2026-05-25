-- ╔══════════════════════════════════════════╗
-- ║  CashFlow — Schema Supabase              ║
-- ║  Execute no SQL Editor do Supabase       ║
-- ╚══════════════════════════════════════════╝

-- CLIENTES
create table if not exists clientes (
  cpf           text primary key,
  nome          text not null default '—',
  total_compras numeric(12,2) not null default 0,
  cashback      numeric(12,2) not null default 0,
  total_resgatado numeric(12,2) not null default 0,
  qtd_vendas    integer not null default 0,
  telefone      text default '',
  ultima_compra text default '',
  loja          text default '—',
  lojas         jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RESGATES
create table if not exists resgates (
  id              bigserial primary key,
  cpf             text references clientes(cpf) on delete set null,
  nome            text,
  loja            text,
  vendedor        text,
  valor_resgatado numeric(12,2),
  saldo_antes     numeric(12,2),
  saldo_depois    numeric(12,2),
  valor_compra    numeric(12,2),
  created_at      timestamptz default now()
);

-- CAMPANHAS
create table if not exists campanhas (
  id         bigserial primary key,
  nome       text,
  canais     text[],
  segmentos  text[],
  mensagem   text,
  loja       text,
  status     text default 'rascunho',
  enviados   integer default 0,
  erros      integer default 0,
  agendado_para timestamptz,
  created_at timestamptz default now()
);

-- CONFIG (armazena configurações como JWT do Almode)
create table if not exists config (
  chave text primary key,
  valor text,
  updated_at timestamptz default now()
);

-- ÍNDICES para performance
create index if not exists idx_clientes_loja on clientes(loja);
create index if not exists idx_clientes_cashback on clientes(cashback desc);
create index if not exists idx_resgates_cpf on resgates(cpf);
create index if not exists idx_resgates_created on resgates(created_at desc);
create index if not exists idx_resgates_loja on resgates(loja);

-- TRIGGER para atualizar updated_at automaticamente
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

-- RLS — Row Level Security
-- Como é um app interno, vamos permitir tudo com a anon key
alter table clientes enable row level security;
alter table resgates enable row level security;
alter table campanhas enable row level security;
alter table config enable row level security;

create policy "allow all clientes" on clientes for all using (true) with check (true);
create policy "allow all resgates" on resgates for all using (true) with check (true);
create policy "allow all campanhas" on campanhas for all using (true) with check (true);
create policy "allow all config" on config for all using (true) with check (true);

select 'Schema criado com sucesso! ✅' as resultado;
