"""HUD real (navegador) — Reações OMNI em combate (gatilhos de dano).
Fichas/peças/combate só no navegador (gravações e sockets bloqueados); somem ao fechar.
Cobre: alcance dentro/fora, protegido aliado vs próprio, sem reação, PE insuficiente,
dano mínimo, passar a vez, TR ramificado e ausência de reação em cadeia."""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright

S = "/tmp/browser/reacoes/"
pathlib.Path(S).mkdir(parents=True, exist_ok=True)
URL = "http://localhost:8080"

CFG = {"id": "punicao", "nome": "Punição ao Agressor", "acao": "reacao", "custoPE": "5",
       "alcanceM": 4.5, "teste": "nenhum", "dano": "4d8", "tipoDano": "Impacto",
       "filtro_alvo": "inimigos", "efeitos": [{"tipo": "condicao", "condicao": "abalado", "rodadas": 2}],
       "reacao": {"gatilho": "quando_sofrer_dano", "alcance_m": 4.5, "protegido": "aliados", "alvo": "origem"}}

SETUP = """(p) => {
  const cs=window.__charStore, ms=window.__mapStore, cb=window.__combatStore, inv=window.__inventoryStore;
  window.__roleStore.setState({role:'MASTER'});
  const D=(ms.getState().gridConfig.dpi||50); window.__D=D;
  const pid=window.__profileStore.getState().activeProfileId;
  const src=cs.getState().characters.find(c=>!c.temporary)||cs.getState().characters[0];
  const mk=(id,o)=>({...src,temporary:false,id,profileId:pid,spells:[],...o});
  const base={escCurrent:0,escMax:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,
    isDead:false,dead:false,rd:0,chosenSpecAbilities:[],specAbilityChoices:{},specAbilityUsage:{},
    attacksThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,
    actionsCurrent:1,actionsMax:1,omniCounters:{},peCurrent:20,peMax:20,hpCurrent:100,hpMax:100,
    defense:5,movement:9,mainHandWeaponName:'Corrente',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
    attributes:[{id:'a1',name:'Força',value:16},{id:'a2',name:'Destreza',value:16},{id:'a3',name:'Sabedoria',value:16}]};
  const guard=mk('r-guard',{...base,name:'TESTE Guardião',category:'MASTER',characterClass:'Guardião',level:5});
  const ally=mk('r-aliado',{...base,name:'TESTE Aliado',category:'MASTER',characterClass:'Guardião',level:5});
  const foe=mk('r-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',characterClass:'Bandido',level:5,
    hpCurrent:200,hpMax:200,peCurrent:20,peMax:20});
  cs.setState({characters:[guard,ally,foe]});
  inv.setState({items:{}});
  const ent={id:'ent-reacao',versao:1,nome:'Corrente do Guardião',categoria:'item',descricao:'',tags:[],
    duracao:{tipo:'permanente'},custos:[],gatilhos:[],criadoEm:0,atualizadoEm:0,acoesAtivas:[p.cfg]};
  inv.getState().add('r-guard',ent,{instanceId:'inst-reacao'});
  ms.setState({entities:{
    eg:{id:'eg',characterId:'r-guard',type:'character',x:p.gx*D,y:0,w:D,h:D},
    ea:{id:'ea',characterId:'r-aliado',type:'character',x:p.ax*D,y:0,w:D,h:D},
    ef:{id:'ef',characterId:'r-ini',type:'character',x:p.fx*D,y:0,w:D,h:D}},
    initiative:{entries:[{id:'i1',name:'G',init:20,entityId:'eg',side:'pc'},
      {id:'i2',name:'A',init:15,entityId:'ea',side:'ally'},
      {id:'i3',name:'F',init:10,entityId:'ef',side:'enemy'}]}});
  cb.setState({inCombat:true,combatId:'cb-reacoes',round:1,
    initiativeOrder:[{charId:'r-guard'},{charId:'r-aliado'},{charId:'r-ini'}],currentTurnIndex:0,movementUsedByChar:{}});
  if (p.patch) window.__charStore.getState().updateCharacter(p.patch.id,p.patch.set);
  return {D, itens:Object.keys(inv.getState().items)};
}"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width": 1280, "height": 1800})
        pg = await c.new_page(); blocked = []

        async def guard(route):
            r = route.request
            if r.method != "GET" and "supabase" in r.url and "/auth/" not in r.url:
                blocked.append(r.url); await route.abort()
            else: await route.continue_()
        await c.route("**/*", guard)
        await c.route_web_socket("**/*", lambda ws: ws.close())
        pg.on("console", lambda m: m.type == "error" and print("CONSOLE", m.text[:150]))
        await pg.goto(URL)
        await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},"
                          f"{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
        await pg.goto(URL); await pg.wait_for_timeout(5000)
        await pg.mouse.click(640, 400); await pg.wait_for_timeout(4000)

        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")
        dialog = pg.get_by_role("dialog", name="Reação OMNI")

        async def dados(n=8):
            for _ in range(n):
                tr = pg.get_by_text("Clique ou segure")
                if await tr.count():
                    await tr.first.click(); await pg.wait_for_timeout(3500)
                else:
                    await pg.wait_for_timeout(700)

        async def limpar():
            if await dialog.count():
                await dialog.get_by_role("button", name="Passar e continuar").first.click()
                await pg.wait_for_timeout(900)

        async def dano(alvo, valor):
            await pg.evaluate("(p)=>window.__charStore.getState().applyDamage(p.a,p.v,'Impacto',{attackerId:'r-ini'})",
                              {"a": alvo, "v": valor})
            await pg.wait_for_timeout(1500)

        async def estado(tag):
            return {"PE": await st('r-guard', 'peCurrent'), "reação": await st('r-guard', 'reactionsCurrent'),
                    "HP inimigo": await st('r-ini', 'hpCurrent'),
                    "condições inimigo": await pg.evaluate("window.__charStore.getState().characters.find(c=>c.id==='r-ini').activeConditions.map(c=>c.conditionId)"),
                    "janela aberta": await dialog.count(), "caso": tag}

        resultados = []

        async def caso(nome, cfg, pos, patch=None, alvo='r-aliado', valor=12, agir=None):
            await limpar()
            await pg.evaluate(SETUP, {"cfg": cfg, "patch": patch, **pos})
            await pg.wait_for_timeout(800)
            antes = await estado(nome + " (antes)")
            await dano(alvo, valor)
            aberto = await dialog.count()
            if agir and aberto:
                await agir()
            depois = await estado(nome + " (depois)")
            await pg.screenshot(path=S + re.sub(r"\W+", "_", nome) + ".png")
            resultados.append({"caso": nome, "antes": antes, "depois": depois, "janela_apareceu": bool(aberto)})
            print(f"[{nome}] janela={'SIM' if aberto else 'não'} | antes {antes} | depois {depois}")
            await limpar()

        # A — aliado a 1m sofre dano: reação deve abrir e, ao clicar, gastar PE+reação, ferir o agressor e aplicá-lo Abalado.
        async def clicar():
            await dialog.get_by_role("button", name=re.compile("Punição ao Agressor")).first.click()
            await dados(8); await pg.wait_for_timeout(2500)
        await caso("A dentro do alcance", CFG, {"gx": 0, "ax": 1, "fx": 3}, agir=clicar)

        # B — guardião a 19m do aliado: fora do alcance, nada deve abrir.
        await caso("B fora do alcance", CFG, {"gx": 19, "ax": 1, "fx": 3})

        # C — proteção só ao próprio portador: dano no aliado não abre; dano no guardião abre.
        cfg_self = json.loads(json.dumps(CFG)); cfg_self["reacao"]["protegido"] = "usuario"
        await caso("C protegido=aliado, dano no aliado", cfg_self, {"gx": 0, "ax": 1, "fx": 3})
        await caso("D protegido=próprio, dano no portador", cfg_self, {"gx": 0, "ax": 1, "fx": 3}, alvo='r-guard', agir=clicar)

        # E — sem reação disponível (0): não deve abrir.
        await caso("E sem reação disponível", CFG, {"gx": 0, "ax": 1, "fx": 3},
                   patch={"id": "r-guard", "set": {"reactionsCurrent": 0}})

        # F — PE insuficiente (4 < 5): não deve abrir.
        await caso("F PE insuficiente", CFG, {"gx": 0, "ax": 1, "fx": 3},
                   patch={"id": "r-guard", "set": {"peCurrent": 4}})

        # G — dano mínimo 10: 5 não abre, 20 abre.
        cfg_min = json.loads(json.dumps(CFG)); cfg_min["reacao"]["dano_minimo"] = 10
        await caso("G dano mínimo, dano 5", cfg_min, {"gx": 0, "ax": 1, "fx": 3}, valor=5)
        await caso("H dano mínimo, dano 20", cfg_min, {"gx": 0, "ax": 1, "fx": 3}, valor=20, agir=clicar)

        # I — passar a vez: nada é gasto.
        async def passar():
            await dialog.get_by_role("button", name="Passar e continuar").first.click()
            await pg.wait_for_timeout(1500)
        await caso("I passar a vez", CFG, {"gx": 0, "ax": 1, "fx": 3}, agir=passar)

        # J — TR ramificado: CD 40 força a falha, então o Abalado deve entrar.
        cfg_tr = json.loads(json.dumps(CFG))
        cfg_tr.update({"teste": "tr", "tr": "fortitude", "cd": "40", "dano": "2d8"})
        await caso("J reação com TR", cfg_tr, {"gx": 0, "ax": 1, "fx": 3}, agir=clicar)

        logs = await pg.evaluate("window.__logStore.getState().logs.slice(0,14).map(l=>l.message)")
        print("LOG:", json.dumps(logs, ensure_ascii=False)[:3000])
        pathlib.Path(S + "resumo.json").write_text(json.dumps(resultados, ensure_ascii=False, indent=1))
        print("gravações bloqueadas:", len(blocked))
        await b.close()

asyncio.run(main())
