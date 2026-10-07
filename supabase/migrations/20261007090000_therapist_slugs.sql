-- Public therapist profile slugs: nawe.co.ke/therapist/<slug>
-- Format: first name + last name, lowercase, ASCII-folded, no separator
-- (e.g. "Jane Wanjiru" -> "janewanjiru").
-- Collisions: append the first two digits found in the therapist's id
-- (e.g. "janewanjiru35"); if the id has fewer than two digits, append a
-- numeric counter instead ("janewanjiru-2").
--
-- Row-level security is unaffected: `slug` is covered by the existing
-- "Public and clients can view verified therapists" SELECT policy on
-- public.therapists, since RLS applies per-row, not per-column.

create extension if not exists unaccent;

alter table public.therapists add column if not exists slug text;

create or replace function public.slugify_therapist_name(p_first_name text, p_last_name text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      lower(unaccent(coalesce(p_first_name, '') || coalesce(p_last_name, ''))),
      '[^a-z0-9]', '', 'g'
    ),
    ''
  );
$$;

create or replace function public.assign_therapist_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  id_digits text;
  counter int := 2;
begin
  if new.slug is not null then
    return new;
  end if;

  select public.slugify_therapist_name(p.first_name, p.last_name)
  into base_slug
  from public.profiles p
  where p.user_id = new.user_id;

  base_slug := coalesce(base_slug, 'therapist');
  candidate := base_slug;

  if exists (select 1 from public.therapists where slug = candidate and id <> new.id) then
    id_digits := regexp_replace(new.id::text, '[^0-9]', '', 'g');
    if length(id_digits) >= 2 then
      candidate := base_slug || substring(id_digits, 1, 2);
    end if;

    while exists (select 1 from public.therapists where slug = candidate and id <> new.id) loop
      candidate := base_slug || '-' || counter;
      counter := counter + 1;
    end loop;
  end if;

  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists therapists_assign_slug on public.therapists;
create trigger therapists_assign_slug
before insert or update of slug on public.therapists
for each row
when (new.slug is null)
execute function public.assign_therapist_slug();

-- Backfill existing rows oldest-first, row by row, so the trigger's
-- collision logic runs deterministically in creation order.
do $$
declare
  r record;
begin
  for r in select id from public.therapists where slug is null order by created_at loop
    update public.therapists set slug = null where id = r.id;
  end loop;
end $$;

alter table public.therapists alter column slug set not null;
alter table public.therapists add constraint therapists_slug_key unique (slug);
