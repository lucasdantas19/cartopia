## Cartopia

Cartopia é uma plataforma de entregas virtuais e lúdicas para mensagens, cartas e presentes digitais. O objetivo do MVP é transformar cada mensagem em uma aventura, permitindo que o destinatário acompanhe a viagem e descubra a surpresa ao final.

### Tecnologias

- Backend: PHP 8.3+ e Laravel 12.
- Banco de dados: PostgreSQL.
- Testes: Pest/PHPUnit.
- Frontend: React, TypeScript e Vite.
- Comunicação: API REST com JSON.

### Convenções

- Prefira soluções simples, incrementais e alinhadas às convenções dos frameworks.
- Não introduza dependências, abstrações ou padrões arquiteturais sem justificativa clara.
- No frontend, mantenha JSX/HTML e estruturas aninhadas quebrados em múltiplas linhas, com indentação consistente e leitura manual fácil.
- Evite componentes, propriedades, condicionais ou handlers inteiros em uma única linha; não compacte código apenas para reduzir o número de linhas.
- Ao editar arquivos existentes do frontend, preserve e melhore a formatação legível para humanos.
- Toda regra de negócio relevante deve ter testes automatizados.
- Preserve arquivos existentes e nunca inclua credenciais ou segredos no Git.
- Não implemente nesta etapa autenticação, entregas, filas, Redis, WebSockets, mapas, infraestrutura Docker/Kubernetes ou IA generativa.
- Não realize commits automaticamente.

Ao concluir uma tarefa, sempre resuma as alterações realizadas, os testes executados e as decisões técnicas relevantes, incluindo limitações encontradas.
