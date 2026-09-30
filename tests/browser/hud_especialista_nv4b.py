"""HUD real (navegador) — Especialista nv 4 parte B: Técnicas de Avanço,
Buscar Oportunidade e Compensar Erro. Fichas/peças/combate só no navegador
(gravações e sockets bloqueados); some ao fechar."""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright

S = "/tmp/browser/hud_nv4b/"
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
          const base={escCurrent:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,chosenSpecAbilities:[],attacksThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1,specAbilityUsage:{}};
          const t=mk('teste-esp',{...base,name:'TESTE Especialista',profileId:pid,category:'PLAYER',characterClass:'Feiticeiro',specialization:'Especialista em Combate',level:5,peCurrent:20,peMax:20,hpCurrent:40,hpMax:40,defense:12,preparoCurrent:8,movement:9,
            mainHandWeaponName:'Espada Longa',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            attributes:[{id:'a1',name:'Força',value:16},{id:'a2',name:'Destreza',value:14},{id:'a3',name:'Sabedoria',value:16}],
            chosenSpecAbilities:['ec-tecnicas-avanco','ec-buscar-oportunidade','ec-compensar-erro'].map(abilityId=>({abilityId,chosenAtLevel:4}))});
          const e1=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5});
          const e2=mk('teste-ini2',{...base,name:'TESTE Inimigo 2',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5});
          cs.setState({characters:[t,e1,e2]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:3*D,y:0,w:D,h:D},e3:{id:'e3',characterId:'teste-ini2',type:'character',x:5*D,y:2*D,w:D,h:D}}});
          cb.setState({inCombat:true,combatId:'cb-hud',round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'},{charId:'teste-ini2'}],currentTurnIndex:0,movementUsedByChar:{}});
          window.__D=D; return {D};
        }"""))
        await pg.wait_for_timeout(1500)
        for nome in ["Fichas", "FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count(): await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2500)
        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")
        pos = lambda: pg.evaluate("(()=>{const e=window.__mapStore.getState().entities.e1;return [e.x/window.__D,e.y/window.__D]})()")

        sec = pg.get_by_test_id("tecnicas-avanco")
        print("SEÇÕES:", await sec.count(), await pg.get_by_test_id("buscar-oportunidade").count())
        await sec.first.scroll_into_view_if_needed(); await pg.screenshot(path=S + "1_secoes.png")

        # Buscar Oportunidade
        await pg.get_by_test_id("buscar-oportunidade-rolar").evaluate("el=>el.click()"); await dados(pg, 4)
        print("BUSCAR:", await st('teste-esp', 'buscarOportunidade'))
        esc = pg.get_by_test_id("buscar-oportunidade-escolha")
        if await esc.count():
            await esc.get_by_role("button", name="Desengajar").click(); await pg.wait_for_timeout(500)
            print("DESENGAJADO DE:", await st('teste-esp', 'desengajadoDe'))
        await pg.get_by_test_id("buscar-oportunidade").scroll_into_view_if_needed(); await pg.screenshot(path=S + "2_buscar.png")

        # Avanço Bumerangue (ponto escolhido: casa 2,0)
        await pg.get_by_test_id("avanco-alvo").select_option("teste-ini")
        await pg.get_by_test_id("avanco-bumerangue").evaluate("el=>el.click()"); await pg.wait_for_timeout(800)
        print("PEDIU PONTO NO MAPA:", await pg.evaluate("!!window.__mapStore.getState().pendingAoEPlacement"))
        await pg.evaluate("window.__mapStore.getState().resolveAoEPlacement({x:2*window.__D,y:0})")
        await dados(pg, 4)
        print("APÓS SALTO pos:", await pos(), "PP:", await st('teste-esp', 'preparoCurrent'), "HP ini:", await st('teste-ini', 'hpCurrent'))
        await pg.get_by_test_id("tecnicas-avanco").scroll_into_view_if_needed(); await pg.screenshot(path=S + "3_retorno.png")
        await pg.get_by_test_id("retorno-so").evaluate("el=>el.click()"); await pg.wait_for_timeout(600)
        print("APÓS RETORNO pos:", await pos())

        # Compensar Erro se o ataque errou
        comp = pg.get_by_test_id("compensar-erro")
        print("COMPENSAR visível:", await comp.count())

        # Sombra Descendente
        await pg.get_by_test_id("avanco-alvo").select_option("teste-ini")
        await pg.get_by_test_id("sombra-descendente").evaluate("el=>el.click()"); await dados(pg, 4)
        print("SOMBRA ações:", await st('teste-esp', 'actionsCurrent'), "PP:", await st('teste-esp', 'preparoCurrent'), "pos:", await pos())
        if await pg.get_by_test_id("sombra-segundo").count():
            await pg.get_by_test_id("sombra-alvo2").select_option("teste-ini2")
            await pg.get_by_test_id("sombra-atacar2").evaluate("el=>el.click()"); await dados(pg, 4)
            await pg.wait_for_timeout(500)
            await pg.evaluate("window.__mapStore.getState().resolveAoEPlacement({x:6*window.__D,y:2*window.__D})"); await pg.wait_for_timeout(800)
        print("QUEDA pos:", await pos(), "HP ini2:", await st('teste-ini2', 'hpCurrent'))
        await pg.get_by_test_id("tecnicas-avanco").scroll_into_view_if_needed(); await pg.screenshot(path=S + "4_sombra.png")
        logs = await pg.evaluate("window.__logStore?window.__logStore.getState().logs.slice(0,14).map(l=>l.message):null")
        print("LOG:", json.dumps(logs, ensure_ascii=False)[:2500])
        print("gravações bloqueadas:", len(blocked))
        await b.close()
asyncio.run(main())
