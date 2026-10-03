# Auditoria final das keys Omni

Concluída em 02/10/2026, na `main` de `myozuru/thesaintpromisse`.

## Cobertura

| Catálogo | Quantidade | Verificação |
| --- | ---: | --- |
| Grupos | 33 | Catálogo completo, sem selecionar somente grupos dos PRs antigos |
| Opções estáticas | 325 | 580 referências nos escopos anunciados, sem diagnósticos de fallback |
| Templates dinâmicos | 20 | Exemplos concretos em USUARIO e ALVO, com valores esperados |
| Total de opções | 345 | Inclui templates; não é contagem de campos únicos da ficha |
| Aliases oficiais de fórmula | 13 | Disponibilidade no parser |

O teste do catálogo monta fichas com os atributos, perícias e TRs padrão.
Os valores de ITEM, DANO e os campos específicos do evento em CENA são
fornecidos como contexto de execução. Não se exige que esses valores
existam permanentemente na ficha. Zero válido passa; referência ausente
ou não finita gera diagnóstico e não passa como implementação válida.

Os templates cobrem grupo de arma, origem, especialização, condições e
duração, contadores e parcelas por fonte, talentos, aptidões, habilidades,
moedas, inventário/equipamento, feitiços, buffs e tipos de feitiços.

## Revisão dos nomes das keys

O catálogo agora prioriza nomes curtos, em português e que descrevem o valor retornado. Removi do seletor abreviações ambíguas, duplicatas e campos que sempre retornavam zero. As fórmulas existentes continuam aceitando os nomes anteriores como aliases; não foi feita migração em massa dos dados salvos.

| Nome anterior | Nome principal no catálogo |
| --- | --- |
| `CENA.dt` | `CENA.dificuldade` |
| `CENA.distancia` | `CENA.distancia_m` |
| `CENA.distancia_xy` / `CENA.distancia_manhattan` | `CENA.distancia_plana` / `CENA.distancia_grade` |
| `CENA.elevacao_diff` | `CENA.diferenca_altura` |
| `CENA.sujeito_eh_aliado` | `CENA.sujeito_aliado` |
| `CENA.outro_eh_inimigo` / `..._aliado` / `..._voce` | `CENA.outro_inimigo` / `outro_aliado` / `outro_e_voce` |
| `DANO.id_origem` / `DANO.id_alvo` | `DANO.tem_atacante` / `DANO.tem_alvo` |
| `origem_id_<id>` / `especializacao_id_<id>` | `origem_<id>` / `especializacao_<id>` |
| `condicao_idade_rodadas_<id>` | `condicao_rodadas_desde_<id>` |
| `condicao_idade_conhecida_<id>` | `condicao_tem_idade_<id>` |
| `condicao_rodadas_<id>` | `condicao_rodadas_restantes_<id>` |
| `qtd_feiticos_elemento_<tipo>` | `qtd_feiticos_tipo_<tipo>` |
| `tem_buff_<spellName>` | `tem_buff_<nome>` |
| `dual_wield` / `dual_wield_def` | `duas_armas` / `defesa_duas_armas` |
| `movimento_bonus_metros` / `rd_alma` | `bonus_movimento` / `reducao_dano_alma` |
| `tr_vs_debuff_defesa_bonus` | `bonus_tr_defesa_reduzida` |
| `max_concentracao` / `max_sustentados` | `concentracao_maxima` / `sustentados_maximos` |
| `slots_liberacao_bonus` | `bonus_slots_liberacao` |
| `aura_ca_bonus` / `aura_rd_fisica` | `aura_bonus_defesa` / `aura_reducao_dano_fisico` |
| `aura_furtividade_bonus` / `aura_agarrar_bonus` | `aura_bonus_furtividade` / `aura_bonus_agarrar` |
| `arma_principal_eh_cac` / `..._eh_distancia` | `arma_principal_corpo_a_corpo` / `arma_principal_a_distancia` |
| `arma_principal_crit_range` | `arma_margem_critico` |
| `spell_attack_bonus` | `bonus_ataque_magia` |
| `tecnica_amaldicoada_definida` / `qtd_fundamentos_tecnica` | `tem_tecnica` / `qtd_fundamentos` |
| `qtd_habilidades_spec` | `qtd_habilidades_especializacao` |
| `pe_por_rodada_sustentado` | `pe_sustentacao_por_rodada` |
| `turno_atual_index` / `turnos_ate_meu` | `indice_turno_atual` / `turnos_ate_meu_turno` |
| `proximo_no_turno` / `ultimo_no_turno` | `sou_proximo_no_turno` / `sou_ultimo_no_turno` |
| `turno_duracao_seg` / `turno_segundos_restantes` | `duracao_turno_segundos` / `segundos_restantes_turno` |
| `qtd_flags_omni` / `qtd_contadores_omni` | `qtd_flags` / `qtd_contadores` |
| `reacao_usada_nesta_rodada` / `reacoes_usadas_nesta_rodada` | `reacao_usada` / `reacoes_usadas` |
| `metros_movidos_neste_turno` | `metros_movidos` |

Abreviações redundantes (`sab`, `pre`, `car`, `treinamento`), aliases repetidos (`bonus_treinamento`, `bonusdetreinamento`), campos constantes ou redundantes (`reserva_pe_atual`, `reserva_pe_max`, `sorte_atual`, `dado_vida_atual`, `fome_nivel`, `empolgacao_nivel`, `esta_morrendo`, `ataques_restantes`, `acao_restante`) e a key incorreta `CENA.turno_de` deixaram de aparecer no seletor. Quando havia valor útil, a opção principal permanece; nomes antigos seguem aceitos pelo parser para compatibilidade.

## Lacunas corrigidas nesta continuação

| Lacuna | Resultado |
| --- | --- |
| Importação Zod descartava campos existentes de efeitos, ações, usos e réplica | Schema preserva o formato completo e o teste valida round-trip |
| Fórmulas passivas não cobriam deslocamento, perícias e TRs | Itens equipados combinam valores fixos e fórmulas; itens explicitamente guardados não aplicam bônus |
| Sinônimos de tipos de dano eram limitados | Sinônimos inequívocos normalizam para os 15 códigos canônicos; termos sem equivalência continuam sem mapeamento |
| Diagnósticos de referências ausentes precisavam ser visíveis | Parser mantém fallback numérico compatível e a prévia do terminal mostra o diagnóstico |

## Lacunas corrigidas nesta etapa

| Lacuna | Resultado |
| --- | --- |
| `CENA.rodada` e `CENA.rodadas_em_combate` anunciadas, mas ausentes no namespace | Leitura do combate real; rodadas em combate retorna 0 fora dele |
| `CENA.turno_de` descrita como ID textual em fórmulas numéricas | Alias de `CENA.turno_indice`, com contrato numérico explícito |
| Predicados de origem/especialização liam somente objetos `{ id }` | Aceitam os nomes textuais das fichas atuais e preservam o formato legado |
| Reconstrução de vários comandos de um gatilho perdia o agrupamento | Cabeçalho e comandos são reemitidos como um bloco agrupado |
| Tipos de dano desapareciam na conversão para texto | Sufixo `tipo` preserva o tipo próprio de cada efeito e subefeito |
| Keys especiais viravam comandos numéricos genéricos ao reabrir | Reconstrução de condição/duração, imunidade, redução de PE, botão e diceSwitch |
| Separadores dentro de branches e rótulos dividiam comandos | Separação respeita parênteses e aspas, inclusive texto com vírgula, seta e ponto e vírgula |
| Callback de combate podia sobreviver ao encerramento de um teste | O teste de Renovação pelo Sangue aguarda os eventos antes de desmontar o ambiente |

## Contratos e exemplos

`@CENA.turno_indice` começa em 0 e retorna -1 quando não existe turno válido.
`@CENA.turno_de` permanece como alias para configurações antigas. Nenhuma
das duas keys representa o ID textual de uma ficha. Para saber se é o
turno do portador, use `@USUARIO.eh_meu_turno`.

Origem e especialização usam nomes sem acentos: `@USUARIO.origem_inato`,
`@ALVO.especializacao_especialista_em_tecnica`. As formas antigas com
`_id_` continuam aceitas como aliases. IDs legados em objetos também são
aceitos, inclusive a normalização antiga.

```text
subtrair 1d8 + @USUARIO.forca em alvo.vida tipo DQ
aplicar cego turnos 2 rodadas -1 em usuario
@fim_turno -> (somar 1 em contador_brasas, somar 1 em pe)
rolar @DANO.tipo entao (1: aplicar cego, 7: remover cego)
```

O catálogo tem 33 grupos, 325 opções estáticas e 20 templates dinâmicos (345 opções no total). O teste mantém exemplos concretos para todos os templates. O autocomplete oferece os 15 códigos do motor, `tipo`, `turnos` e `rodadas`. Scripts antigos sem essas cláusulas continuam válidos.
Valores antigos de tipo podem ser reemitidos entre aspas para preservação,
inclusive quando não têm equivalência no motor. Isso não cria uma nova
regra de mitigação para esses nomes.

## Compatibilidade e limites conhecidos

- Aliases e caminhos legados permanecem disponíveis. A auditoria não
  executa uma migração em lote sobre as entidades dos usuários.
- `Amaldiçoado`, `Força`, `Verdadeiro` e `Cura` continuam sem equivalência
  automática para tipos do motor; dano sem tipo usa RD geral.
- DANO representa um evento recebido. Tipo, fonte, flags e distância
  desconhecidos ficam ausentes; os campos finais não existem no pre-hook.
  Um golpe produzido por um efeito usa sua própria origem e seu próprio tipo.
- Campos dependentes de evento, resultado anterior, item ou mapa precisam
  do contexto correspondente. O diagnóstico diferencia ausência de zero.
- Flags táticas configuráveis continuam dependendo de quem as alimenta.
  Disponibilidade no parser não significa cálculo automático de iluminação,
  linha de visão ou terreno em todos os pontos do jogo.
- A ponte numérica preserva o fallback legado para referências desconhecidas.
  O catálogo auditado tem valores nos contextos apropriados; nomes livres
  ainda podem gerar diagnóstico até serem definidos.
- A proteção de cadeias da etapa 10 permanece em 16 níveis e 256 passos
  compartilhados. Ela cobre os caminhos Omni documentados, sem afirmar
  propagação em todos os produtores externos de eventos do jogo.

## Validação desta revisão

- 49 pares de aliases de nomes antigos e novos.
- 69 testes de cobertura do catálogo e compatibilidade.
- 550 testes de auditoria geral das keys.
- Catálogo: 325 opções estáticas e 20 templates; 580 referências resolvidas nos escopos anunciados.
- 68 testes do bridge Omni, incluindo fórmulas passivas e importação.
- 4 testes de geometria de trajetória de reações.
- 72 testes de aliases de dano e diagnósticos de fórmulas.
- A suíte completa, TypeScript e build não foram repetidos nesta revisão; os números abaixo documentam a auditoria anterior de 02/10/2026.

Auditoria anterior: 2.621 testes em 138 arquivos, `npx tsc --noEmit`,
`npm run build` e `git diff --check`.

Para repetir a cobertura do catálogo:

```sh
OMNI_AUDIT_SUMMARY=1 npx vitest run src/test/omniCatalogCoverage.test.ts --reporter=verbose
```

As lacunas listadas nesta continuação estão concluídas. Os limites conhecidos
acima descrevem contratos de contexto e decisões explícitas de compatibilidade.
