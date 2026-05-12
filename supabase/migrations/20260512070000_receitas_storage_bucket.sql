-- Bucket para cache de PDFs de receitas baixadas da Memed/Assemed.
-- Leitura pública (URLs já são compartilhadas com a farmácia); escrita apenas via service role (servidor).

insert into storage.buckets (id, name, public)
values ('receitas', 'receitas', true)
on conflict (id) do update set public = true;

-- Leitura pública
drop policy if exists "Receitas public read" on storage.objects;
create policy "Receitas public read"
  on storage.objects for select
  using (bucket_id = 'receitas');
