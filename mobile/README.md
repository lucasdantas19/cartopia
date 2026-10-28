# Cartopia Mobile

## Testar em um celular na rede local

O celular não consegue acessar `localhost` do computador. Crie `mobile/.env.local` apontando para o IP local da máquina que executa o Laravel:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.42:8000/api/v1
```

Substitua `192.168.1.42` pelo IP do computador na mesma rede Wi-Fi. Depois inicie a API aceitando conexões da rede:

```bash
cd backend
php artisan serve --host=0.0.0.0 --port=8000
```

Em outro terminal, inicie o Expo na mesma rede:

```bash
cd mobile
nvm use
npm start -- --lan
```

Abra o QR code com o Expo Go. Se o celular não conectar, confirme que o firewall permite conexões TCP na porta 8000 e que computador e celular estão na mesma rede.

Para Android Emulator, a URL normalmente é `http://10.0.2.2:8000/api/v1`; para iOS Simulator, `http://127.0.0.1:8000/api/v1`.
