"""HUD real (navegador) — Especialista em Combate nível 4.

Armas Escolhidas e Arremesso Rápido. Cria ficha/peças/combate SÓ no
navegador (gravações de nuvem e sockets bloqueadas) e some ao fechar.
"""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright

S = "/tmp/browser/hud_nv4/"
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
          const base={hpCurrent:30,hpMax:30,escCurrent:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,defense:12,chosenSpecAbilities:[],attacksThisTurn:1,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1,specAbilityUsage:{}};
          const t=mk('teste-esp',{...base,name:'TESTE Especialista',profileId:pid,category:'PLAYER',characterClass:'Feiticeiro',specialization:'Especialista em Combate',level:4,peCurrent:20,peMax:20,hpCurrent:40,hpMax:40,
            mainHandWeaponName:'Faca de Arremesso',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            attributes:[{id:'a1',name:'Força',value:14},{id:'a2',name:'Destreza',value:16},{id:'a3',name:'Constituição',value:16},{id:'a4',name:'Astúcia',value:12}],
            chosenSpecAbilities:[{abilityId:'ec-armas-escolhidas',chosenAtLevel:4},{abilityId:'ec-arremesso-rapido',chosenAtLevel:4}],
            specAbilityChoices:{'ec-armas-escolhidas':{kind:'weapon-group',group:'Faca'}}});
          const e=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5,attributes:[{id:'b1',name:'Astúcia',value:10}]});
          cs.setState({characters:[t,e]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:2*D,y:0,w:D,h:D}}});
          cb.setState({inCombat:true,round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0});
          return {pid,n:cs.getState().characters.length,D};
        }"""))
        await pg.wait_for_timeout(2000)

        for nome in ["Fichas", "FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count():
                await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2500)

        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")
        sec = pg.get_by_test_id("arremesso-rapido")
        print("SEÇÃO Arremesso Rápido:", await sec.count(), (await sec.first.inner_text()).replace("\n", " ") if await sec.count() else "")
        if await sec.count():
            await sec.first.scroll_into_view_if_needed()
        await pg.screenshot(path=S + "hud.png")

        await pg.get_by_test_id("arremesso-rapido-alvo").select_option("teste-ini"); await pg.wait_for_timeout(400)
        await pg.get_by_test_id("arremesso-rapido-usar").evaluate("el=>el.click()"); await pg.wait_for_timeout(1200)
        print("PE:", await st('teste-esp', 'peCurrent'), "| ação bônus:", await st('teste-esp', 'bonusActionsCurrent'),
              "| rodada:", await st('teste-esp', 'arremessoRapidoRound'))
        print("BOTÃO desabilitado depois:", await pg.get_by_test_id("arremesso-rapido-usar").is_disabled())

        ban = pg.get_by_test_id("arremesso-rapido-banner")
        print("BANNER:", await ban.count(), (await ban.first.inner_text()) if await ban.count() else "")
        if await ban.count():
            await ban.first.scroll_into_view_if_needed()
        await pg.screenshot(path=S + "banner.png")

        await pg.get_by_role("button", name=re.compile("Rolar Ataque")).first.evaluate("el=>el.click()"); await pg.wait_for_timeout(2000)
        for _ in range(6):
            tr = pg.get_by_text("Clique ou segure")
            if await tr.count():
                await tr.first.click(); await pg.wait_for_timeout(6000)
            d = pg.get_by_role("button", name=re.compile("Rolar Dano"))
            if await d.count():
                await d.first.click(); await pg.wait_for_timeout(2000)
        await pg.wait_for_timeout(2000)
        print("HP inimigo:", await st('teste-ini', 'hpCurrent'))
        await pg.screenshot(path=S + "ataque.png")
        logs = await pg.evaluate("(window.__logStore?window.__logStore.getState().logs.slice(0,8).map(l=>l.message):null)")
        print("LOG:", logs)
        print("ARMAS ESCOLHIDAS no log:", any("Armas Escolhidas" in (m or "") for m in (logs or [])))
        print("gravações bloqueadas:", len(blocked))
        await b.close()

asyncio.run(main())
