# REVISÃO PÓS-AJUSTES — branch feat/herdado-dez-sombras (workspace TSP-revisao-integracao)

ARQUIVOS ANALISADOS:
- src/components/fichas/OriginStep.tsx (ajustado)
- src/components/fichas/ControladorInvocacoesSection.tsx

---

## CONFIRMAÇÃO: Character.tecnicaAmaldicoada = 'Dez Sombras' LIBERA O CATÁLOGO SEM AUTO-ADICIONAR SHIKIGAMIS ✅

**ControladorInvocacoesSection.tsx:**

- **temTecnicaDezSombras** (linha 372): gate booleano que normaliza `character.tecnicaAmaldicoada` e verifica se inclui 'dez sombras'

- **importarDezSombras** (linhas 379-430):
  * BLOQUEIA se `!temTecnicaDezSombras` com erro explícito
  * Cria fichas-base + derivadas via `criarPacoteDezSombras()` + `criarFormasDerivadasDezSombras()`
  * FILTRA as já existentes no catálogo (não sobrescreve)
  * EXIGE imagem em cada cartão pendente antes da importação em lote
  * ADICIONA à `invocacoesConhecidas` SÓ após usuário escolher imagens e clicar "Importar"

- **adicionarFichaDezSombras** (linhas 431-452):
  * Mesmo gate `temTecnicaDezSombras`
  * Verifica duplicata por subcategoria
  * Adiciona UMA ficha por clique no botão "+ Adicionar à biblioteca"

- **UI** (linhas 932, 1054, 1128): botões desabilitados quando `!temTecnicaDezSombras`; texto "Técnica necessária"

✅ **CONFIRMADO**: Catálogo é LIBERADO (botões habilitados, seção visível) mas shikigamis NÃO são adicionados automaticamente — requer ação explícita do usuário (escolher imagem + clicar importar/adicionar).

---

## ORIGINSTEP.TSX — AJUSTES DE ACESSIBILIDADE/SEMÂNTICA ✅

### 1. Botões de clã (linhas 141-161):
- `type="button"` ✅
- `aria-pressed={choices.clan === c}` ✅
- `role="group"` + `aria-labelledby="inherited-clan-choice-label"` no container ✅
- Label visível "Selecionar Clã" com id ✅

### 2. Dropdown técnica herdada (linhas 163-184):
- `role="group"` + `aria-labelledby="inherited-clan-technique-label"` ✅
- Label: "Técnica herdada do clã (opcional)" — "(opcional)" explícito ✅
- `aria-describedby="inherited-clan-technique-help"` ✅
- Help text (linha 181): "Deixe em 'escolher depois' se não for usar uma técnica automatizada nesta ficha. Escolher Dez Sombras salva a técnica e libera seu catálogo na seção de invocações; os shikigamis ainda precisam ser adicionados e adquiridos separadamente em jogo." — CLARO ✅

### 3. Opção padrão:
- `<option value="">— escolher depois —</option>` ✅

---

## ACHADOS MENORES / OBSERVAÇÕES

⚠️ **ControladorInvocacoesSection.tsx** - Botões "+ Adicionar à biblioteca" (linhas 1051-1064, 1125-1138):
- São `<button type="button">` com `disabled` condicional — OK
- Mas o container `<article>` não tem `role="listitem"` nem o grid `role="list"` — semântica de lista poderia ser melhorada para leitores de tela

⚠️ **ControladorInvocacoesSection.tsx** - Seção "Pacote Dez Sombras" (linha 921):
- `<section aria-label="Pacote Dez Sombras">` — OK
- Botão "Importar fichas" (linha 932): `disabled={!temTecnicaDezSombras}` — OK
- Texto de requisito (linha 936): `role="status"` com "Cadastre 'Dez Sombras'..." — OK

⚠️ **validação no wizard** (CharacterWizard.tsx não revisado agora):
- `canProceed()` step 2 ainda não valida `inheritedTechnique` obrigatório para Zenin — usuário pode avançar com "— escolher depois —"
- Se a regra exigir técnica obrigatória para Zenin/Dez Sombras, falta validação (fora do escopo destes 2 arquivos)

---

## RESUMO

**BLOQUEADORES: 0**

**CONFIRMAÇÃO PRINCIPAL: ✅** `Character.tecnicaAmaldicoada = 'Dez Sombras'` libera o catálogo de importação (botões habilitados, seção visível) SEM adicionar shikigamis automaticamente — fluxo manual por imagem + clique confirmado em `importarDezSombras` e `adicionarFichaDezSombras`.

**ACESSIBILIDADE/SEMÂNTICA OriginStep: ✅** ARIA correta, `role="group"`, `aria-pressed`, label "(opcional)", help text claro.

**MELHORIAS MENORES:** `role="list"/"listitem"` no grid de fichas Dez Sombras; validação wizard opcional.

## RESOLUÇÃO APÓS A REVISÃO

- Semântica das fichas corrigida em `ControladorInvocacoesSection.tsx`: os dois grids usam `role="list"` e os cartões usam `role="listitem"`.
- A validação de técnica no wizard permanece opcional por decisão de produto: a técnica herdada automatizada é uma escolha, não um requisito para todo personagem Zenin. A opção e o texto de ajuda deixam isso explícito.
- TypeScript, build e `git diff --check` passaram após os ajustes.
