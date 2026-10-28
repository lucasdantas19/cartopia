# API mobile v1

O aplicativo mobile deve usar `/api/v1` como base. As rotas sem versão continuam disponíveis para compatibilidade com o frontend web atual.

## Autenticação

Rotas públicas:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Rotas autenticadas usam:

```http
Authorization: Bearer {token}
Accept: application/json
```

Rotas de sessão:

- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## Entregas

- `POST /api/v1/deliveries`
- `GET /api/v1/deliveries/{publicId}` com token da entrega
- `GET /api/v1/deliveries/{publicId}/message` com token do destinatário

A criação continua disponível sem autenticação. Quando o token da conta estiver presente, a entrega será associada ao usuário remetente.

## Conta

- `GET /api/v1/account/deliveries`
- `GET /api/v1/account/incoming-deliveries`
- `GET /api/v1/account/incoming-deliveries/{publicId}/token`
- `GET|POST|DELETE /api/v1/account/locations`
- `GET|POST|DELETE /api/v1/account/recipients`
- `GET|POST|DELETE /api/v1/account/tracked-deliveries`
- `GET /api/v1/account/tracked-deliveries/{id}/token`

## Compatibilidade

Não remover as rotas atuais até que o aplicativo mobile e o frontend web estejam usando a API versionada. Mudanças incompatíveis devem entrar somente em uma nova versão, como `/api/v2`.
