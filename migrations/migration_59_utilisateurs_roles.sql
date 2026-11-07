-- Migration 59 : comptes applicatifs, rôles et journal des actions.
-- À exécuter une fois dans Supabase (SQL Editor). Sans danger si relancée.
--
-- Rôles : administrateur | chef_atelier | direction | maintenance | lecture  (voir netlify/functions/lib/droits.js)
-- Comptes existants : alain (almak000@gmail.com) devient administrateur, les autres comptes deviennent « chef_atelier »
-- (leurs droits actuels sont conservés, hors devis / coûts / administration). Un compte créé plus tard directement dans
-- Supabase reçoit le rôle « lecture » jusqu'à ce qu'un administrateur lui en attribue un.

create table if not exists utilisateurs (
  user_id    uuid primary key,
  email      text not null default '',
  role       text not null default 'lecture' check (role in ('administrateur', 'chef_atelier', 'direction', 'maintenance', 'lecture')),
  actif      boolean not null default true,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  modifie_par text
);
create index if not exists utilisateurs_email_idx on utilisateurs (lower(email));
alter table utilisateurs enable row level security;   -- aucune politique : seul le serveur (clé service) y accède

create table if not exists journal_actions (
  id       bigserial primary key,
  cree_le  timestamptz not null default now(),
  user_id  uuid,
  email    text,
  role     text,
  fonction text not null,
  methode  text,
  action   text,
  cible    jsonb not null default '{}'::jsonb,
  statut   integer
);
create index if not exists journal_actions_date_idx on journal_actions (cree_le desc);
create index if not exists journal_actions_email_idx on journal_actions (email, cree_le desc);
alter table journal_actions enable row level security;

-- Comptes déjà créés dans Supabase Auth
insert into utilisateurs (user_id, email, role)
select u.id, coalesce(u.email, ''),
       case when lower(coalesce(u.email, '')) = 'almak000@gmail.com' then 'administrateur' else 'chef_atelier' end
from auth.users u
on conflict (user_id) do nothing;

-- Filet de sécurité : si aucun administrateur n'existe (adresse différente de celle ci-dessus), le plus ancien compte le devient.
update utilisateurs set role = 'administrateur'
where user_id = (select u.id from auth.users u join utilisateurs x on x.user_id = u.id order by u.created_at asc limit 1)
  and not exists (select 1 from utilisateurs where role = 'administrateur');

-- Contrôle : doit afficher au moins un administrateur actif
notify pgrst, 'reload schema';
select email, role, actif from utilisateurs order by role, email;
