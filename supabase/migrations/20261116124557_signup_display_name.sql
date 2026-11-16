-- The name given at signup becomes the profile's display name (it pre-fills the ebook author).
-- Signup metadata is written by the user: only this field is read from it, cleaned and capped
-- to the column's limit so an oversized value cannot make the signup fail. Access never comes from it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(nullif(btrim(regexp_replace(new.raw_user_meta_data ->> 'display_name', '[[:space:][:cntrl:]]+', ' ', 'g')), ''), 100)
  );
  return new;
end;
$$;
