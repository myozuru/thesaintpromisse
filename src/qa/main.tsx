import { createRoot } from 'react-dom/client';
import {
  dezSombrasQaEnvironmentAllowed,
  dezSombrasQaOriginAllowed,
} from '../lib/qa/dezSombrasQaGate';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do QA não encontrado.');

const permitido = dezSombrasQaEnvironmentAllowed(
  import.meta.env.DEV,
  import.meta.env.VITE_DEZ_SOMBRAS_QA,
) && dezSombrasQaOriginAllowed(window.location.hostname, window.location.port);

function Restrito() {
  return (
    <main className="container">
      <h1>Área indisponível</h1>
      <p>Este painel só abre no servidor local de QA iniciado pelo launcher do projeto.</p>
    </main>
  );
}

function PainelQa() {
  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">Ambiente local isolado · 127.0.0.1:5181</p>
        <h1>QA — Dez Sombras</h1>
        <p className="note">Fonte normativa: Enciclopédia Maldita (F&amp;M 2.5.2), v1.1.1.</p>
        <p>O painel é informativo. A validação de combate roda em Vitest com fixtures descartáveis e controladores reais.</p>
      </header>

      <section className="card" aria-labelledby="isolation-title">
        <h2 id="isolation-title">Limites do ambiente</h2>
        <ul>
          <li>Aplicação Vite independente, sem o roteador, a raiz visual ou os stores do site.</li>
          <li>Escuta apenas em <code>127.0.0.1:5181</code>, com falha se a porta já estiver ocupada; não compartilha a origem de <code>localhost:5180</code>.</li>
          <li>Não importa controladores, autenticação, Supabase, localStorage ou IndexedDB. Não contém botões que executem ações de campanha.</li>
          <li>Não carrega fontes, imagens ou scripts de terceiros.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="coverage-title">
        <h2 id="coverage-title">Cobertura automatizada</h2>
        <p>Execute a suíte focada na raiz do projeto:</p>
        <pre><code>npm run test:dez-sombras</code></pre>
        <ul>
          <li>A suíte contém cenários determinísticos de invocação, mapa, ações e formas derivadas. Os valores e ações desta versão precisam ser conferidos contra a edição v1.1.1 ao executar a suíte.</li>
          <li>São cenários selecionados com personagens e mapas sintéticos; não representam todas as combinações possíveis nem um aceite visual ao vivo no portal principal.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="rules-title">
        <h2 id="rules-title">Arbitragem manual preservada</h2>
        <p>O material-fonte deixa parâmetros operacionais em aberto. O módulo mantém esses efeitos sem execução automática até o Mestre decidir:</p>
        <ul>
          <li>Fuga dos Coelhos é uma Horda oficial: crescimento de PV/tamanho, dano de enxame, líder e dispersão em coelhos individuais exigem estado próprio no combate.</li>
          <li>Elefante Máximo: Torrente de Água depende da geometria de uma linha no mapa; Massa Esmagadora depende da queda e da distância vertical.</li>
          <li>Cervo Circular: aura, remoção de condições e Neutralização precisam consultar condições e técnicas ativas em área.</li>
          <li>Touro Perfurante: a Investida integra movimento e ataque, soma +1d8 por 3 m retos, reconhece curvas acima de 45° e aplica crítico automático ao completar o deslocamento; Inércia dobra o deslocamento na rodada, ignora redução e impedimento de movimento e eleva a Investida em dois níveis de dano. Ruptura dobra o dano contra objetos, mas a defesa e a durabilidade desses objetos precisam de arbitragem do Mestre.</li>
          <li>Mahoraga: dano recebido pelo fluxo do mapa atualiza automaticamente os estágios, a Roda por propriedade de dano, RD, reduções e o limite de 1 PV; a Vontade Divina aciona e conta rodadas no turno do Controlador, ignorando controle mental/intimidação externa durante Máquina. O Mestre pré-registra contatos não danosos para o bloqueio do 4º giro, acompanha condições e TR na HUD e executa manualmente a prioridade/ação da Máquina, a revelação de efeitos invisíveis e adaptações a ambiente/obstáculos quando a fonte não está integrada ao mapa.</li>
          <li>Tigre Fúnebre: perfil oficial. Redução cumulativa de Defesa, reação extra e recuperação de Defesa requerem estado por alvo e turno.</li>
          <li>Totalidade, Abismo, Nue: Totalidade e Agito são formas oficiais listadas na p. 69, mas a edição não publica fichas numéricas completas; os valores locais são provisórios e ficam pendentes de aprovação do Mestre.</li>
          <li>Manipulação de Maldições: absorção, invocações Rápida/Explosiva/Emergencial, efeitos de sacrifício e libertação dependem de integração do motor e seguem manuais até haver estado de combate específico.</li>
          <li>Estoque, Ocultação, Passo Sombrio, Fuga do Coelho e Jardim das Sombras Sobrepostas ainda exigem integração de custos, seleção, geometria ou duração.</li>
        </ul>
        <p className="note">A lista oficial da p. 65 contém dez entradas: os dois Cães aparecem em fichas separadas; Fuga dos Coelhos e Tigre Fúnebre são perfis oficiais.</p>
      </section>
    </main>
  );
}

createRoot(root).render(permitido ? <PainelQa /> : <Restrito />);
