# Etapa 8 — recursos e proteções

Estado: catálogo de destinos de escrita do executor formalizado, métricas derivadas bloqueadas e dois caminhos de recurso alinhados às operações oficiais da ficha.

## Leitura e escrita

`validarDestinoEscritaNatural` usa os destinos aceitos pelo `aplicarEfeitoNoPersonagem` e pelo resolvedor de destinos compostos. O validador não executa efeitos e não altera scripts legados. Ele retorna canal e caminho canônico para destinos apoiados; distingue métricas derivadas (somente leitura) de caminhos ainda sem implementação.

Métricas como `vida_pct`, `vida_faltante`, `vida_total`, `pe_faltante`, `reserva_pe_recuperavel`, `morrendo`, `morto` e `inconsciente` seguem consultáveis e são recusadas como destino de escrita, inclusive nas formas compostas como `percentual vida`. Consultar uma métrica não autoriza atribuir a ela.

Recursos atuais, como `vida`, `pe`, `vida temporaria`, `fome` e `exaustao`, seguem graváveis apenas pelos caminhos que o executor reconhece. Máximos de ficha, por exemplo `vida maximo`, continuam distintos das métricas derivadas: o projeto já possui uma rota explícita de setter para eles.

## Correções encontradas

- `fome` podia ultrapassar 24 quando alterada pelo caminho Omni genérico. Escrita agora passa por `setHunger`, que limita o valor ao intervalo 0–24.
- `exaustao` era atualizada diretamente e podia deixar de sincronizar condições automáticas, inconsciência e morte. Escrita agora passa por `setExhaustion`, preservando clamp 0–6 e regras existentes.
- Dano e cura em `vida` continuam delegados a `applyDamage`/`applyHealing`; a consulta de vida não realiza desconto direto.

## Canais de proteção

- `vida temporaria` (PVTs não temporizados) e `pe temporario` são identificados como canal protetivo do executor.
- `bloqueio total` é uma flag consumida pelo pipeline de dano; não se confunde com PV nem com RD.
- Proteções OMNI com duração continuam sendo concedidas e expiradas pelo fluxo de ação ativa (`pv_temporarios`/`escudo`) e mantidas em `protecoesOmni`. A escrita genérica em `vida_temp` não inventa nem altera a duração desse ledger.
- O validador declara a política para o compilador natural futuro; a sintaxe natural ainda não aplica ações em runtime.

## Validação

`omniComposicaoEscrita.test.ts` cobre destinos suportados e não suportados, métricas somente leitura, caminhos de proteção, limites de Fome e sincronização da Exaustão. `omniSuporteAtivo.test.tsx` mantém os testes existentes do ledger de proteções temporárias, dano recebido, expiração e sincronização entre fichas.
