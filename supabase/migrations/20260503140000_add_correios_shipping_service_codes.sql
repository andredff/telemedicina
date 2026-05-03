-- Add Correios Preco/Prazo service-code settings without overwriting panel values.

insert into public.site_settings (key, value, description)
values (
  'correios',
  '{
    "enabled": true,
    "apiBaseUrl": "https://api.correios.com.br",
    "apiToken": "",
    "apiUsername": "",
    "apiPassword": "",
    "postingCard": "",
    "contractNumber": "",
    "contractDr": "",
    "trackingPollMinutes": 60,
    "trackingResultType": "T",
    "originCep": "",
    "pacServiceCode": "03298",
    "sedexServiceCode": "03220"
  }'::jsonb,
  'Configuracoes das APIs Correios Rastro, Preco e Prazo'
)
on conflict (key) do update
set value = public.site_settings.value
  || case
    when public.site_settings.value ? 'pacServiceCode' then '{}'::jsonb
    else '{"pacServiceCode": "03298"}'::jsonb
  end
  || case
    when public.site_settings.value ? 'sedexServiceCode' then '{}'::jsonb
    else '{"sedexServiceCode": "03220"}'::jsonb
  end,
  description = excluded.description;
