"""HUD real (navegador) — Reações OMNI em testes pedidos pelo Mestre (TR forçado por inimigo).
Fichas/peças/combate só no navegador (gravações e sockets bloqueados); somem ao fechar.
Cobre: alcance dentro/fora, protegido aliado vs próprio, sem reação, PE insuficiente,
dano mínimo, passar a vez, TR ramificado e ausência de reação em cadeia."""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright

S = "/tmp/browser/reacoes_testes/"
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
  inv.setState({items:{},deleted:{}});
  const ent={id:'ent-reacao',versao:1,nome:'Corrente do Guardião',categoria:'item',descricao:'',tags:[],
    duracao:{tipo:'permanente'},custos:[],gatilhos:[],criadoEm:0,atualizadoEm:0,acoesAtivas:[p.cfg]};
  inv.getState().add('r-guard',ent,{instanceId:'inst-reacao-'+Math.random().toString(36).slice(2,9)});
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

        async def dados(n=10):
            """Rola os dados que a reação pedir e espera o resultado assentar."""
            for _ in range(n):
                tr = pg.get_by_text("Clique ou segure")
                if await tr.count():
                    await tr.first.click(force=True); await pg.wait_for_timeout(3000)
                else:
                    await pg.wait_for_timeout(600)

        async def limpar():
            if await dialog.count():
                await dialog.get_by_role("button", name="Passar e continuar").first.click(force=True, timeout=6000)
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

        async def logs(n=4):
            return await pg.evaluate(f"window.__logStore.getState().logs.slice(0,{n}).map(l=>l.message)")


        async def pedido(origem, cfg, nome, esperar_janela=True, agir=None):
            await limpar()
            await pg.evaluate(SETUP, {"cfg": cfg, "patch": None, "gx": 0, "ax": 1, "fx": 3})
            await pg.evaluate("(o)=>{const s=window.__testRequestStore;s.setState({requests:[]});s.getState().enqueue({charId:'r-aliado',charName:'TESTE Aliado',kind:'save',testName:'Vontade',dc:15,originId:o||undefined})}", origem)
            await pg.wait_for_timeout(1500)
            await pg.get_by_role("button", name=re.compile("Rolar d20", re.I)).first.click(force=True, timeout=8000)
            await pg.wait_for_timeout(2500)
            aberto = await dialog.count()
            await pg.screenshot(path=S + re.sub(r"\W+", "_", nome) + "_janela.png")
            if aberto and agir: await agir()
            elif aberto: await limpar()
            await dados(8)
            for _ in range(15):
                r = await pg.evaluate("window.__testRequestStore.getState().requests[0]?.result")
                if r: break
                await dados(1)
            await pg.screenshot(path=S + re.sub(r"\W+", "_", nome) + ".png")
            print(f"[{nome}] janela={'SIM' if aberto else 'não'} resultado={r} PE={await st('r-guard','peCurrent')} HPini={await st('r-ini','hpCurrent')}")
            print("   logs", json.dumps(await logs(4), ensure_ascii=False)[:500])

        cfg = json.loads(json.dumps(CFG)); cfg["reacao"] = {"gatilho": "quando_alvo_de_tr", "alcance_m": 4.5, "protegido": "aliados", "alvo": "origem", "bonus_teste": 5}
        async def clicar():
            await dialog.get_by_role("button", name=re.compile("Punição ao Agressor")).first.click(force=True, timeout=8000)
            await dados(6)
        await pedido("r-ini", cfg, "A com origem e reacao (+5)", agir=clicar)
        await pedido(None, cfg, "B sem origem")
        await pedido("r-ini", cfg, "C com origem, passar")
        cfgc = json.loads(json.dumps(cfg)); cfgc["reacao"]["cancelar_evento"] = True
        await pedido("r-ini", cfgc, "D anular (sucesso automatico)", agir=clicar)
        print("gravações bloqueadas:", len(blocked))
        await b.close()

asyncio.run(main())