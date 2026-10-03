# Digitação no editor OMNI

A edição de scripts recompilava o mesmo texto no terminal e no construtor a cada alteração. O simulador lateral também fazia 200 avaliações por efeito automaticamente, inclusive durante a edição. Esses trabalhos disputavam a thread de interface com o teclado.

## Alterações

- Nos terminais passivo e ativo do construtor, o texto é mantido localmente e aparece imediatamente. Compilação e cores são atualizadas após 250 ms sem alterações.
- O resultado compilado acompanha o texto entregue ao construtor; ele não recompila o mesmo script novamente.
- Ao perder foco ou sair da aba, o último rascunho é entregue imediatamente e o timer é cancelado.
- Tab e inserções externas continuam usando o texto atual. O retorno do formulário não sobrescreve uma edição mais recente.
- O contexto da ficha usado na prévia do terminal é reutilizado enquanto a ficha permanece igual.
- O índice de autocomplete é normalizado e ordenado uma vez, sem nova ordenação por tecla.
- As 200 amostras do simulador são preservadas, mas executadas pelo botão **Calcular médias**. Mudanças nas fórmulas ou nos parâmetros invalidam o resultado anterior e pedem novo cálculo.

## Evidências

O teste de digitação simula 200 alterações consecutivas: nenhuma recompilação ou entrega ao formulário acontece durante a sequência; após a pausa, ocorre uma única compilação e uma única entrega. Outros casos verificam blur, desmontagem da aba, Tab e inserção externa.

O teste do simulador verifica zero amostras automáticas durante edição, 200 amostras após o clique e invalidação sem recálculo automático após modificar a fórmula.

Regressão completa: 176 arquivos e 3.698 testes passaram. Checks específicos adicionais cobrem a proteção ao sair da aba. TypeScript e build de produção passaram. A evidência é automatizada; não representa uma medição de latência no navegador do usuário.

## Complemento: scripts maiores

A primeira correção não isolava toda a análise do teclado. A compilação dos scripts passivo e ativo agora roda em um Web Worker após a pausa. Respostas de versões antigas são descartadas, e o worker é encerrado ao fechar o terminal. Blur e troca de aba continuam entregando o último texto; ambientes sem worker usam a compilação local como fallback.

O parser reutiliza uma única tokenização para localizar várias composições na expressão. O autocomplete consulta somente a palavra anterior e respeita argumentos com aspas abertas. O painel de análise é memoizado e não reconstrói as frases de execução a cada tecla. A formatação de nomes foi separada dos módulos que alteram fichas para que o worker importe apenas código de compilação.

Checks adicionais: 300 composições com uma tokenização; autocomplete após 1.000 comandos lendo apenas `arma_principal`; nomes entre aspas; solicitação ao worker sem compilação local; resposta antiga ignorada; entrega da resposta atual; encerramento do worker e fallback de inicialização. Regressão final: 178 arquivos e 3.704 testes aprovados, TypeScript sem erros e build de produção com o bundle do worker.

Esses checks verificam as operações executadas, não uma reprodução do travamento no navegador do usuário.
