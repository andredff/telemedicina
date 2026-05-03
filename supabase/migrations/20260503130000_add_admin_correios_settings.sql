-- Centralize Correios/logistics configuration in the admin settings panel.

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
  'Configurações da API Rastro dos Correios'
)
on conflict (key) do nothing;

update public.site_settings
set value = case
  when value ? 'logisticsEmail' then value
  else value || '{"logisticsEmail": ""}'::jsonb
end
where key = 'notifications';
