import './App.css'

export function PrivacyPage() {
  return <>
    <section className="privacy-page">
      <p className="eyebrow">Informação e cuidado</p>
      <h1>Política de Privacidade</h1>
      <p className="lead">Esta página explica, em linguagem simples, como o Cartopia trata as informações usadas no Beta para criar e acompanhar uma entrega.</p>

      <div className="privacy-content">
        <section>
          <h2>Quais dados usamos</h2>
          <p>Ao criar uma entrega, o Cartopia pode receber o nome do remetente, o nome do destinatário e o conteúdo da mensagem. Também são armazenadas informações da entrega, como identificador público, origem, destino, duração escolhida, entregador, horários de partida e chegada e o estado de abertura da carta.</p>
          <p>Não é necessário criar uma conta de usuário. Os links de acesso usam tokens secretos. O Cartopia armazena apenas os hashes desses tokens, e não os tokens em texto claro.</p>
        </section>

        <section>
          <h2>Para que usamos essas informações</h2>
          <p>Usamos os dados para criar a entrega, mostrar o trajeto e o progresso, controlar quando a mensagem pode ser aberta, permitir a abertura pelo destinatário e informar ao remetente quando a carta foi aberta.</p>
        </section>

        <section>
          <h2>Links de acesso</h2>
          <p>O link do destinatário permite acompanhar a entrega e abrir a mensagem depois da chegada. O link do remetente permite acompanhar a entrega e consultar a confirmação de abertura, mas não dá acesso ao conteúdo da carta.</p>
          <p>Esses links funcionam como credenciais. Quem tiver um link válido poderá usá-lo dentro das permissões correspondentes. Compartilhe cada link somente com a pessoa adequada e evite publicá-lo em locais abertos. Depois do primeiro acesso, o navegador guarda a credencial na sessão para permitir o recarregamento da página; ela não é usada como parâmetro de consulta da API.</p>
        </section>

        <section>
          <h2>Armazenamento e proteção</h2>
          <p>As informações são armazenadas na infraestrutura necessária para executar o Cartopia, incluindo a aplicação e o banco de dados. O acesso às entregas depende do token secreto; o conteúdo da carta não é transmitido para o link do remetente.</p>
          <p>O Cartopia não afirma oferecer criptografia ponta a ponta nem que as mensagens sejam criptografadas no banco. A proteção depende também da segurança da hospedagem, do navegador e do compartilhamento dos links.</p>
        </section>

        <section>
          <h2>Serviços utilizados</h2>
          <p>O Beta pode utilizar serviços necessários de hospedagem, banco de dados, entrega da aplicação e comunicação em tempo real. O mapa é carregado pelo MapLibre usando o estilo público do OpenFreeMap, com dados e atribuição do OpenStreetMap. Esses serviços podem receber informações técnicas necessárias para entregar seus próprios recursos, conforme seus termos e políticas.</p>
          <p>O acompanhamento e a abertura da carta não devem depender do serviço em tempo real: se ele estiver indisponível, os fluxos principais continuam usando a API.</p>
        </section>

        <section>
          <h2>Retenção e exclusão</h2>
          <p>O backend está preparado com um prazo padrão de 90 dias após a chegada da entrega. A exclusão automática depende da ativação de um agendamento no ambiente de produção e ainda não está ativa na VPS. O prazo pode ser ajustado por configuração e deve ser confirmado como política definitiva antes da publicação.</p>
          <p>Não há uma tela de autoatendimento para apagar entregas. Pedidos de esclarecimento ou exclusão devem ser encaminhados pelo canal de contato oficial informado pelo responsável pelo Cartopia; esse canal ainda precisa ser confirmado antes da publicação definitiva desta política.</p>
        </section>

        <section>
          <h2>Sobre esta política</h2>
          <p>Esta é uma política inicial para o Beta público e descreve o funcionamento atual conhecido da aplicação. Ela deve ser revisada quando houver mudanças no armazenamento, na infraestrutura, nos fornecedores ou no canal de atendimento.</p>
        </section>
      </div>
    </section>
  </>
}
