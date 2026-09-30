"""HUD real (navegador) — Zona de Risco.

Cria ficha/peças/combate SÓ no navegador (gravações de nuvem e sockets
bloqueadas) e some ao fechar. Nunca toca em dados reais de campanha.
"""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright

S = "/tmp/browser/hud_zona_risco/"
pathlib.Path(S).mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width": 1280, "height": 1800})
        pg = await c.new_page()
        blocked = []

        async def guard(route):
            r = route.request
            if r.method != "GET" and "supabase" in r.url and "/auth/" not in r.url:
                blocked.append(r.method + " " + r.url[:60]); await route.abort()
            else:
                await route.continue_()

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
          const base={hpCurrent:30,hpMax:30,escCurrent:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,defense:12,chosenSpecAbilities:[],attacksThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1,specAbilityUsage:{}};
          const t=mk('teste-esp',{...base,name:'TESTE Especialista',profileId:pid,category:'PLAYER',characterClass:'Feiticeiro',specialization:'Especialista em Combate',level:4,peCurrent:20,peMax:20,hpCurrent:10,hpMax:40,
            mainHandWeaponName:'Alabarda',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            attributes:[{id:'a1',name:'Força',value:14},{id:'a2',name:'Destreza',value:14},{id:'a3',name:'Constituição',value:16},{id:'a4',name:'Astúcia',value:12}],
            skills:[{id:'s1',name:'Furtividade',value:0,linkedAttribute:'a2',trained:true}],
            chosenSpecAbilities:[{abilityId:'ec-zona-risco',chosenAtLevel:2}]});
          const e=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5,attributes:[{id:'b1',name:'Astúcia',value:10}]});
          const a=mk('teste-ali',{...base,name:'TESTE Aliado',category:'PLAYER'});
          cs.setState({characters:[t,e,a]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:6*D,y:0,w:D,h:D},e3:{id:'e3',characterId:'teste-ali',type:'character',x:5*D,y:0,w:D,h:D}}});
          cb.setState({inCombat:true,round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:1});
          return {pid,n:cs.getState().characters.length,D};
        }"""))
        await pg.wait_for_timeout(2000)

        # abre o Mapa e move o inimigo para dentro do alcance (3 m)
        for nome in ["Mapa","MAPA"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count():
                await t.first.click(force=True); break
        await pg.wait_for_timeout(3000)
        await pg.evaluate("""()=>{const ms=window.__mapStore;const D=ms.getState().gridConfig.dpi||50;
          ms.getState().updateEntity('e2',{x:2*D,y:0});
          ms.getState().setPendingMove({entityId:'e2',charId:'teste-ini',startX:6*D,startY:0,trail:[],distM:6});}""")
        await pg.wait_for_timeout(1000)
        await pg.get_by_title("Confirmar movimento").first.evaluate("el=>el.click()"); await pg.wait_for_timeout(800)
        dlg = pg.get_by_role("dialog", name="Zona de Risco")
        print("PERGUNTA:", await dlg.count(), (await dlg.inner_text()).replace("\n"," ") if await dlg.count() else "")
        await pg.screenshot(path=S+"pergunta.png")
        await dlg.get_by_text("Atacar (2 PE)").evaluate("el=>el.click()"); await pg.wait_for_timeout(800)
        st = lambda i,f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")
        print("PE:", await st('teste-esp','peCurrent'), "| reação:", await st('teste-esp','reactionsCurrent'), "| rodada:", await st('teste-esp','zonaRiscoRound'))
        # 2º movimento na mesma rodada não pergunta
        await pg.evaluate("""()=>{const ms=window.__mapStore;const D=ms.getState().gridConfig.dpi||50;
          ms.getState().updateEntity('e2',{x:1*D,y:0});
          ms.getState().setPendingMove({entityId:'e2',charId:'teste-ini',startX:2*D,startY:0,trail:[],distM:1.5});}""")
        await pg.wait_for_timeout(800)
        await pg.get_by_title("Confirmar movimento").first.evaluate("el=>el.click()"); await pg.wait_for_timeout(800)
        print("PERGUNTA 2ª vez:", await pg.get_by_role("dialog", name="Zona de Risco").count())
        # volta para Fichas e ataca
        for nome in ["Fichas","FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count():
                await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2000)
        ban = pg.get_by_test_id("zona-risco-banner")
        print("BANNER:", await ban.count(), (await ban.first.inner_text()) if await ban.count() else "")
        if await ban.count():
            await ban.first.scroll_into_view_if_needed()
        await pg.screenshot(path=S+"banner.png")
        await pg.get_by_role("button", name=re.compile("Rolar Ataque")).first.evaluate("el=>el.click()"); await pg.wait_for_timeout(2000)
        for _ in range(6):
            tr = pg.get_by_text("Clique ou segure")
            if await tr.count():
                await tr.first.click(); await pg.wait_for_timeout(6000)
            d = pg.get_by_role("button", name=re.compile("Rolar Dano"))
            if await d.count():
                await d.first.click(); await pg.wait_for_timeout(2000)
        await pg.wait_for_timeout(2000)
        print("HP inimigo:", await st('teste-ini','hpCurrent'))
        await pg.screenshot(path=S+"ataque.png")
        print("LOG:", await pg.evaluate("(window.__logStore?window.__logStore.getState().logs.slice(0,6).map(l=>l.message):null)"))
        print("gravações bloqueadas:", len(blocked))
        await b.close()

asyncio.run(main())
