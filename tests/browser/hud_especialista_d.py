"""HUD real (navegador) — Presença Suprimida, Revigorar e Tiro Falso.

Cria ficha/peças/combate SÓ no navegador (gravações de nuvem e sockets
bloqueadas) e some ao fechar. Nunca toca em dados reais de campanha.
"""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright

S = "/tmp/browser/hud_especialista_d/"
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
            mainHandWeaponName:'Pistola',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            attributes:[{id:'a1',name:'Força',value:14},{id:'a2',name:'Destreza',value:14},{id:'a3',name:'Constituição',value:16},{id:'a4',name:'Astúcia',value:12}],
            skills:[{id:'s1',name:'Furtividade',value:0,linkedAttribute:'a2',trained:true}],
            chosenSpecAbilities:[{abilityId:'ec-presenca-suprimida',chosenAtLevel:2},{abilityId:'ec-revigorar',chosenAtLevel:3},{abilityId:'ec-tiro-falso',chosenAtLevel:4}]});
          const e=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:10,attributes:[{id:'b1',name:'Astúcia',value:10}]});
          const a=mk('teste-ali',{...base,name:'TESTE Aliado',category:'PLAYER'});
          cs.setState({characters:[t,e,a]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:4*D,y:0,w:D,h:D},e3:{id:'e3',characterId:'teste-ali',type:'character',x:5*D,y:0,w:D,h:D}}});
          cb.setState({inCombat:true,round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0});
          return {pid,n:cs.getState().characters.length,D};
        }"""))
        await pg.wait_for_timeout(2000)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=S + "ficha.png")

        hp = lambda: pg.evaluate("window.__charStore.getState().characters.find(c=>c.id==='teste-esp').hpCurrent")
        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")

        # ── Revigorar (ação bônus) ──────────────────────────────────────
        rv = pg.get_by_test_id("revigorar-usar")
        await rv.scroll_into_view_if_needed(); await pg.screenshot(path=S + "revigorar_antes.png")
        antes = await hp()
        await rv.click(); await pg.wait_for_timeout(2000)
        for _ in range(4):
            tr = pg.get_by_text("Clique ou segure")
            if await tr.count():
                await tr.first.click(); await pg.wait_for_timeout(7000)
        await pg.wait_for_timeout(3000)
        print("REVIGORAR hp", antes, "->", await hp(),
              "| ação bônus:", await st('teste-esp', 'bonusActionsCurrent'),
              "| usos:", json.dumps(await st('teste-esp', 'specAbilityUsage')))
        await pg.screenshot(path=S + "revigorar_depois.png")

        # ── Tiro Falso (reação) ─────────────────────────────────────────
        sec = pg.get_by_test_id("tiro-falso-secao")
        await sec.scroll_into_view_if_needed()
        await pg.get_by_label(re.compile("Aliado que vai atacar")).select_option("teste-ali")
        await pg.get_by_label(re.compile("Inimigo atacado")).select_option("teste-ini")
        await pg.wait_for_timeout(500); await pg.screenshot(path=S + "tirofalso_antes.png")
        print("TIRO FALSO texto:", (await sec.inner_text()).replace("\n", " | "))
        await pg.get_by_test_id("tiro-falso-usar").click(); await pg.wait_for_timeout(2000)
        for _ in range(4):
            tr = pg.get_by_text("Clique ou segure")
            if await tr.count():
                await tr.first.click(); await pg.wait_for_timeout(7000)
        await pg.wait_for_timeout(3000)
        print("TIRO FALSO reação:", await st('teste-esp', 'reactionsCurrent'),
              "| vantagem aliado:", json.dumps(await st('teste-ali', 'omniAdvMods')))
        await pg.screenshot(path=S + "tirofalso_depois.png")

        # ── Presença Suprimida (Furtividade) ────────────────────────────
        per = pg.get_by_text("PERÍCIAS", exact=True)
        if await per.count():
            await per.first.click(force=True); await pg.wait_for_timeout(1500)
            await per.first.scroll_into_view_if_needed(); await pg.wait_for_timeout(500)
            await pg.screenshot(path=S + "pericias_aberta.png")
        chk = pg.get_by_test_id("chamativa-check")
        if await chk.count():
            await chk.first.scroll_into_view_if_needed()
            print("CHECKBOX:", await pg.get_by_test_id("chamativa-label").first.inner_text())
            await pg.screenshot(path=S + "furtividade.png")
            await chk.first.evaluate("el=>el.click()"); await pg.wait_for_timeout(500)
            print("CHECKBOX marcado:", await chk.first.is_checked())
            # Rola Furtividade de verdade e confere os rótulos do resultado.
            linha = pg.get_by_text("Furtividade", exact=True).first.locator("xpath=ancestor::div[3]")
            print("LINHA HTML:", (await linha.inner_html())[:400])
            dado = linha.get_by_role("button")
            print("PERICIA visivel:", await pg.get_by_text("Furtividade").first.is_visible(), "| botoes:", await dado.count())
            if await dado.count():
                await dado.first.click(force=True); await pg.wait_for_timeout(4000)
                for _ in range(3):
                    tr = pg.get_by_text("Clique ou segure")
                    if await tr.count():
                        await tr.first.click(); await pg.wait_for_timeout(6000)
            await pg.wait_for_timeout(2000)
            import re as _re
            body = await pg.inner_text("body")
            print("ROLAGEM:", [l for l in body.split("\n") if _re.search("Furtividade|chamativa|presença suprimida", l)][:8])
            await pg.screenshot(path=S + "furtividade_rolagem.png")
        else:
            print("CHECKBOX não encontrado na tela atual")

        print("LOG:", await pg.evaluate("(window.__logStore?window.__logStore.getState().logs.slice(-8).map(l=>l.message):null)"))
        print("gravações bloqueadas:", len(blocked))
        await b.close()

asyncio.run(main())
