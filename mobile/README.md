# Cartopia Mobile

## Testar em um celular na rede local

O celular não consegue acessar `localhost` do computador. Crie `mobile/.env.local` apontando para o IP local da máquina que executa o Laravel:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.42:8000/api/v1
EXPO_PUBLIC_WEB_URL=http://192.168.1.42:5173
```

Substitua `192.168.1.42` pelo IP do computador na mesma rede Wi-Fi. A URL web é usada nos links compartilhados após criar uma entrega. Depois inicie a API aceitando conexões da rede:

```bash
cd backend
php artisan serve --host=0.0.0.0 --port=8000
```

Para abrir os links compartilhados no navegador de outro dispositivo, inicie também o frontend na rede:

```env
# frontend/.env.local
VITE_API_URL=http://192.168.1.42:8000/api
VITE_REVERB_ENABLED=false
```

Inclua `http://192.168.1.42:5173` em `CORS_ALLOWED_ORIGINS` no `backend/.env`. Reinicie o Laravel após alterar esse valor. Então execute:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Em outro terminal, inicie o Expo na mesma rede:

```bash
cd mobile
nvm use
npm start -- --lan
```

Abra o QR code com o Expo Go. Se o celular não conectar, confirme que o firewall permite conexões TCP na porta 8000 e que computador e celular estão na mesma rede.
Para usar os links web, permita também a porta TCP 5173. Em produção, configure `EXPO_PUBLIC_WEB_URL` com a origem pública do frontend.

## Escolher lugares reais no mapa

A tela de criação pede uma origem e um destino reais. Em cada campo, é possível pesquisar um lugar ou tocar no mapa para marcar o ponto. A busca usa o mesmo token público do Mapbox usado pelo frontend web:

```env
# mobile/.env.local
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.seu_token_publico
```

Sem esse token, ainda é possível tocar no mapa e informar o nome do lugar. O app envia nome e coordenadas em `origin_location` e `destination_location` para a API; os dois pontos precisam ser diferentes. O mapa funciona no Expo Go com o Expo SDK 58; para distribuir um build Android próprio, configure a chave do Google Maps conforme a documentação do `react-native-maps` no Expo. Restrinja os tokens públicos no provedor e nunca coloque chaves privadas em variáveis `EXPO_PUBLIC_`.

Para Android Emulator, a URL normalmente é `http://10.0.2.2:8000/api/v1`; para iOS Simulator, `http://127.0.0.1:8000/api/v1`.
