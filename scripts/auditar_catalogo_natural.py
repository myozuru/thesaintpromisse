"""Inventário estático do rascunho natural; presença textual não prova execução.

Uso: python scripts/auditar_catalogo_natural.py /caminho/especificacao.txt
Não altera o motor nem migra scripts. Saídas em docs/omni.
"""
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OMNI = ROOT / 'src/lib/omni'
aliases_text = (OMNI / 'keyAliases.ts').read_text()
alias_block = aliases_text.split('export const LEGACY_TO_CANONICAL')[1].split('};')[0]
aliases = dict(re.findall(r"'([^']+)'\s*:\s*'([^']+)'", alias_block))
sources = {
    name: (OMNI / name).read_text()
    for name in ['resolvedor.ts', 'constantesDoSistema.ts', 'omniScript.ts',
                 'aplicarEfeito.ts', 'executor.ts', 'contextoDano.ts']
}
skills = set('atletismo acrobacia furtividade prestidigitacao feiticaria historia investigacao oficio1 oficio2 oficio3 tecnologia teologia direcao intuicao medicina ocultismo percepcao sobrevivencia enganacao intimidacao performance persuasao'.split())
saves = set('astucia fortitude integridade reflexos vontade'.split())
recipes = set('renovacao_sangue golpe_duplo golpe_empurrao golpe_puxao derrubar_alvo desarmar_alvo atordoar_golpe quebrar_armadura contra_ataque_livre fintar_alvo golpe_giratorio golpe_trespassar quebra_postura interceptar_golpe guarda_estudada afinidade_fogo afinidade_raio afinidade_impacto afinidade_alma ressonancia_magica eco_amaldicoado canalizacao_forca ressonancia_eco protecao_guardiao postura_terra postura_ceu postura_lua postura_dragao'.split())
obsolete = {'por_carga', 'por_carga_gasta', 'cargas_gastas', 'cargas_origem'}
command_keys = {'zerar_contador', 'limpar_condicoes', 'curar_vida', 'curar_pe', 'curar_pvts', 'dissipar_magia', 'contra_magica', 'recompensa_item', 'registro_log'}
stages = {1:7,2:8,3:8,4:7,5:7,6:9,7:9,8:10,9:10,10:11,11:10,12:12,13:12,14:13,15:18,16:16,17:15,18:16,19:17,20:16,21:18,22:13,23:6,24:14,25:20,26:18,27:18,28:13,29:16,30:15,31:19,32:20,33:22}
read_only = set('vida_temp_pct vida_total vida_pct pe_pct pe_faltante pe_faltante_pct tem_reserva_pe reserva_recuperavel metade_da_vida esta_ferido total_contadores total_condicoes metros_restantes distancia_alvo distancia_aliado alvos_na_area inimigos_perto aliados_perto saldo_total peso_carregado espacos_livres'.split())
units = {'deslocamento':'metros','aura_raio':'metros','distancia_alvo':'metros','distancia_aliado':'metros','alcance_visao':'metros','metros_movidos':'metros','metros_restantes':'metros','turno_segundos_restantes':'segundos','turno_duracao':'segundos','hora_do_dia':'hora do mundo','tempo_em_cena':'minutos'}

def context(group, key):
    if group == 14: return 'cópia do item de origem'
    if group == 17: return 'ocorrência de dano; parcela quando aplicável'
    if group == 22: return 'arma identificada do ataque e sua empunhadura'
    if group in {16,18,20,29}: return 'usuário e tokens relevantes na cena; alvo quando referenciado'
    if group in {15,21,27}: return 'criatura, janela temporal e combate/calendário'
    if group == 26: return 'carteira, moeda e titular; inventário nas métricas de carga'
    if group == 33: return 'cena e usuário autenticado'
    if group == 10: return 'titular e contador nominal; execução para gastos; ciclo para contribuições'
    if group in {25,32}: return 'habilidade/feitiço identificado e seu titular'
    return 'criatura explicitamente resolvida; origem para modificadores'

def classify(group, key):
    if key.startswith('pericia_'):
        if key[8:] not in skills: return 'remover do catálogo canônico', 'Perícia do rascunho não pertence às 22 reais; não criar equivalência automática.'
    if key.startswith('tr_') and key[3:] not in saves:
        return 'remover do catálogo canônico', 'TR inexistente; substituir pelo catálogo real, não converter em atributo.'
    if key in obsolete: return 'substituir expressão', 'Exigir contador nominal; não usar último consumo genérico.'
    if key in recipes: return 'receita', 'Compor primitivas; não registrar mecânica específica como key universal.'
    if '<' in key: return 'modelo parametrizado', 'Exige argumento identificado e validação; não contar cada instância como primitiva.'
    if key in command_keys or key.startswith(('aplicar ', 'remover ', 'imune ')):
        return 'comando', 'Auditar destinatário, custo, autorização e resultado; sintaxe natural ainda não comprovada.'
    if key in aliases: return 'alias legado identificado', f'keyAliases.ts associa a {aliases[key]}; isso não prova suporte da frase natural.'
    return 'consulta/modificador a verificar', 'Registro, leitura, escrita e frase natural exigem validação individual; evidência textual é apenas localização.'

text = pathlib.Path(sys.argv[1]).read_text()
entries = []
group = None
for line_number, line in enumerate(text.splitlines(), 1):
    match = re.search(r'GRUPO (\d+): (.*?) \(', line)
    if match: group = (int(match[1]), match[2])
    match = re.match(r'\*\s+([^|]+)\|\s*([^|]+)\|\s*Ex:\s*(.*)', line)
    if not match or not group: continue
    key, description, example = (v.strip() for v in match.groups())
    number, label = group
    kind, decision = classify(number, key)
    canonical = aliases.get(key, key)
    if key.startswith('tr_') and key[3:] in saves: canonical = key[3:]
    evidence = []
    for file, body in sources.items():
        pattern = r'(?<![\w])' + re.escape(canonical) + r'(?![\w])'
        positions = [i for i, row in enumerate(body.splitlines(),1) if re.search(pattern,row,re.I)]
        if positions: evidence.append({'file':f'src/lib/omni/{file}','lines':positions[:5]})
    entries.append({'id':len(entries)+1,'group':number,'group_label':label,'key':key,
        'draft_description':description,'draft_example':example,'draft_line':line_number,
        'classification':kind,'canonical_candidate':canonical,'decision':decision,
        'context':context(number,key),'unit':units.get(key,'percentual 0–100' if key.endswith('_pct') else 'a determinar no contrato da entrada'),
        'write':'proibida: derivado' if key in read_only else 'não certificada; conferir writer e política',
        'permission':'MASTER e backend para alteração global' if number == 33 else 'validar titularidade; ocultação para consultas de terceiros',
        'stage':stages[number],'evidence':evidence,'runtime_status':'não certificado por esta auditoria estática'})

assert set(e['group'] for e in entries) == set(range(1,34)), 'Grupo ausente'
assert len({e['key'] for e in entries}) == len(entries), 'Entrada repetida'
counts = collections.Counter(e['classification'] for e in entries)
lines = ['# Inventário individual do rascunho OMNI natural', '',
    f'{len(entries)} entradas em 33 grupos. Fonte: Texto colado(4), com decisões posteriores aplicadas na classificação.', '',
    'Este inventário é estático: correspondência textual não comprova leitura, escrita, autorização nem execução. Nenhuma frase natural é certificada aqui. Descrições e exemplos do rascunho são preservados no JSON para rastreabilidade, não recomendados para uso.', '',
    '## Resultado da classificação', '']
lines += [f'- {kind}: {count}' for kind,count in sorted(counts.items())]
for number in range(1,34):
    subset = [e for e in entries if e['group']==number]
    lines += ['',f"## Grupo {number}: {subset[0]['group_label']}",'',
              '| Entrada | Classificação / decisão | Contexto obrigatório | Escrita | Evidência estática | Etapa |',
              '|---|---|---|---|---|---|']
    for e in subset:
        ev = '; '.join(f"{v['file'].split('/')[-1]}:{','.join(map(str,v['lines']))}" for v in e['evidence']) or 'Sem ocorrência exata nos seis arquivos examinados; não prova ausência do motor.'
        lines.append(f"| `{e['key']}` | {e['classification']}: {e['decision']} | {e['context']} | {e['write']} | {ev} | {e['stage']} |")
lines += ['', '## Pendências reais da etapa 1', '',
    'Auditar as entradas não certificadas com o registro de composição e testes de leitura/escrita/contexto; fechar tipos/unidades e validade por entrada; verificar políticas backend. As etapas indicadas implementam ou aprofundam suporte, não certificam o estado atual.', '',
    'Achados confirmados: o rascunho ainda contém perícias/TR fora do catálogo aprovado; exemplos usam consumos sem contador nominal; canonicalizarChave preserva nomes desconhecidos e lerCaminhoOmni possui fallback zero, portanto normalização não equivale a validação estrita; aliases de dano aprovados precisam ser confrontados com contextoDano.ts.', '']
out = ROOT/'docs/omni'
out.mkdir(parents=True, exist_ok=True)
(out/'inventario-natural.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
(out/'inventario-natural.md').write_text('\n'.join(lines))
print(json.dumps({'entries':len(entries),'groups':33,'classification':counts},ensure_ascii=False))
