"""HUD real (navegador) — Réplicas materializáveis (OMNI). Fichas/peças/combate só no navegador (gravações e sockets
bloqueados); somem ao fechar."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/replicas/"
pathlib.Path(S).mkdir(parents=True, exist_ok=True)

async def dados(pg, n=6):
    for _ in range(n):
        tr = pg.get_by_text("Clique ou segure")
        if await tr.count():
            await tr.first.click(); await pg.wait_for_timeout(5000)
        else:
            await pg.wait_for_timeout(800)

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
        await pg.goto("http://localhost:8080")
        await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
        await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(5000)
        await pg.mouse.click(640, 400); await pg.wait_for_timeout(4000)
        print(await pg.evaluate("""()=>{
          const cs=window.__charStore, ms=window.__mapStore, cb=window.__combatStore;
          const D=(ms.getState().gridConfig.dpi||50);
          const pid=window.__profileStore.getState().activeProfileId;
          const src=cs.getState().characters.find(c=>!c.temporary)||cs.getState().characters[0];
          const mk=(id,o)=>({...src,temporary:false,id,...o});
          const base={escCurrent:0,escMax:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,chosenSpecAbilities:[],attacksThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1,specAbilityUsage:{}};
          const t=mk('teste-esp',{...base,name:'TESTE Especialista',profileId:pid,category:'PLAYER',characterClass:'Feiticeiro',specialization:'Especialista em Combate',level:5,peCurrent:20,peMax:20,hpCurrent:40,hpMax:40,defense:12,movement:9,
            mainHandWeaponName:'Espada Longa',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            attributes:[{id:'a1',name:'Força',value:16},{id:'a2',name:'Destreza',value:16},{id:'a3',name:'Sabedoria',value:18}],
            specAbilityChoices:{'ec-guarda-estudada':{kind:'save',save:'Fortitude'}},
            chosenSpecAbilities:['ec-guarda-estudada','ec-espirito-luta'].map(abilityId=>({abilityId,chosenAtLevel:4}))});
          const e1=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5});
          cs.setState({characters:[t,e1]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:D,y:0,w:D,h:D}}});
          cb.setState({inCombat:true,combatId:'cb-replica',round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0,movementUsedByChar:{}});
          window.__D=D; return {D};
        }"""))
        await pg.wait_for_timeout(1500)
        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")
        await pg.evaluate("""()=>{
          window.__charStore.getState().updateCharacter('teste-esp',{mainHandWeaponName:null,offHandWeaponName:null});
          const inv=window.__inventoryStore;
          inv.setState({items:{}});
          inv.getState().add('teste-esp',{id:'rep1',versao:1,nome:'Lâmina Copiada',categoria:'arma',descricao:'',tags:['modelo:katana'],duracao:{tipo:'permanente'},custos:[],gatilhos:[],replica:{porte:'medio',peInvocacao:3,peSustentacao:2,desintegrarAoSoltar:true,cobrarPorRodada:true},criadoEm:0,atualizadoEm:0});
        }""")
        for nome in ["Fichas", "FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count(): await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2500)
        sec = pg.get_by_test_id("replicas-section")
        print("SEÇÃO réplicas:", await sec.count())
        await sec.first.scroll_into_view_if_needed(); await sec.first.screenshot(path=S+"1_antes.png")
        await sec.get_by_role("button", name="Materializar (3 PE)").click(); await pg.wait_for_timeout(800)
        print("MATERIALIZOU → PE:", await st('teste-esp','peCurrent'), "mão:", await st('teste-esp','mainHandWeaponName'))
        await pg.screenshot(path=S+"2_materializada.png", clip={"x":0,"y":0,"width":1280,"height":1800})
        alvo = pg.get_by_test_id("attack-target")
        if await alvo.count(): await alvo.select_option(label="TESTE Inimigo")
        botao = pg.get_by_role("button", name="Rolar Ataque")
        if await botao.count():
            await botao.first.evaluate("el=>el.click()"); await dados(pg, 5)
        print("HP inimigo após ataque:", await st('teste-ini','hpCurrent'))
        # vira turno duas vezes → volta ao Especialista → prompt de sustentação
        await pg.evaluate("window.__combatStore.getState().nextTurn(); window.__combatStore.getState().nextTurn()")
        await pg.wait_for_timeout(1500)
        pr = pg.get_by_test_id("replica-sustentacao-prompt")
        print("PROMPT sustentação:", await pr.count())
        if await pr.count(): await pr.screenshot(path=S+"3_prompt.png")
        await pg.get_by_test_id("replica-sustentar").click(); await pg.wait_for_timeout(600)
        print("SUSTENTOU → PE:", await st('teste-esp','peCurrent'))
        await pg.evaluate("window.__combatStore.getState().nextTurn(); window.__combatStore.getState().nextTurn()")
        await pg.wait_for_timeout(1500)
        await pg.get_by_test_id("replica-deixar").click(); await pg.wait_for_timeout(600)
        print("DEIXOU DESFAZER → mão:", await st('teste-esp','mainHandWeaponName'), "PE:", await st('teste-esp','peCurrent'))
        # materializa de novo e solta a arma
        await sec.get_by_role("button", name="Materializar (3 PE)").click(); await pg.wait_for_timeout(600)
        await pg.evaluate("window.__charStore.getState().updateCharacter('teste-esp',{mainHandWeaponName:null,offHandWeaponName:null})")
        await pg.wait_for_timeout(800)
        print("SOLTOU → materializada:", await pg.evaluate("Object.values(window.__inventoryStore.getState().items)[0].materializada"))
        logs = await pg.evaluate("window.__logStore?window.__logStore.getState().logs.slice(0,12).map(l=>l.message):null")
        print("LOG:", json.dumps(logs, ensure_ascii=False)[:2500])
        await sec.first.screenshot(path=S+"4_final.png")
        await pg.evaluate("window.__inventoryStore.getState().remove(Object.keys(window.__inventoryStore.getState().items)[0])")
        print("gravações bloqueadas:", len(blocked))
        await b.close()
asyncio.run(main())
