create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists contas (
  id uuid primary key default gen_random_uuid(),
  banco text,
  agencia text,
  conta text,
  nome text not null,
  categoria_id uuid references categorias(id) on delete set null,
  saldo numeric(14,2) not null default 0,
  observacao text,
  ativa boolean not null default true,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table if not exists historico_saldos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas(id) on delete cascade,
  saldo numeric(14,2) not null,
  data_registro date not null default current_date,
  criado_em timestamptz not null default now()
);

alter table categorias enable row level security;
alter table contas enable row level security;
alter table historico_saldos enable row level security;

drop policy if exists "Acesso total categorias" on categorias;
drop policy if exists "Acesso total contas" on contas;
drop policy if exists "Acesso total historico" on historico_saldos;

create policy "Acesso total categorias" on categorias for all using (true) with check (true);
create policy "Acesso total contas" on contas for all using (true) with check (true);
create policy "Acesso total historico" on historico_saldos for all using (true) with check (true);

insert into categorias (nome)
values ('Recurso Próprio'), ('FUNDEB'), ('Transporte'), ('Emendas')
on conflict (nome) do nothing;
