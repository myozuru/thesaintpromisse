"""HUD real (navegador) — Especialista nv 4 parte D: Guarda Estudada e
Espírito de Luta. Fichas/peças/combate só no navegador (gravações e sockets
bloqueados); somem ao fechar."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/hud_nv4d/"
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
          cb.setState({inCombat:true,combatId:'cb-hud-d',round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0,movementUsedByChar:{}});
          window.__D=D; return {D};
        }"""))
        await pg.wait_for_timeout(1500)
        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")

        for nome in ["Fichas", "FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count(): await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2500)

        # ── Guarda Estudada: Defesa com e sem a habilidade ────────────────────
        defesa = await pg.evaluate("""()=>{
          const cs=window.__charStore.getState();
          const c=cs.characters.find(x=>x.id==='teste-esp');
          return {sab:(c.attributes.find(a=>a.name==='Sabedoria')||{}).value, defesaFicha:c.defense};
        }""")
        print("FICHA:", defesa)
        await pg.screenshot(path=S + "1_ficha.png")

        # TR escolhido recebe +2 na rolagem da ficha
        for alvo in ["Fortitude", "Reflexos"]:
            botao = pg.get_by_text(alvo, exact=True)
            if await botao.count():
                await botao.first.scroll_into_view_if_needed()
                await botao.first.click(force=True); await pg.wait_for_timeout(2500)
                await dados(pg, 3)
        logs = await pg.evaluate("window.__logStore?window.__logStore.getState().logs.slice(0,8).map(l=>l.message):null")
        print("LOG TR:", json.dumps(logs, ensure_ascii=False)[:1200])
        await pg.screenshot(path=S + "2_tr.png")

        # ── Espírito de Luta ─────────────────────────────────────────────────
        sec = pg.get_by_test_id("espirito-luta-secao")
        print("SEÇÃO Espírito de Luta:", await sec.count())
        if await sec.count(): await sec.first.scroll_into_view_if_needed()
        await pg.get_by_test_id("espirito-luta-usar").evaluate("el=>el.click()")
        await pg.wait_for_timeout(800)
        print("APÓS ATIVAR → PE:", await st('teste-esp', 'peCurrent'),
              "escudo:", await st('teste-esp', 'escCurrent'),
              "ações:", await st('teste-esp', 'actionsCurrent'),
              "bônus:", await st('teste-esp', 'bonusActionsCurrent'),
              "desabilitado:", await pg.get_by_test_id("espirito-luta-usar").is_disabled())
        await pg.screenshot(path=S + "3_espirito.png")

        # ── Ataque real com o +2 ─────────────────────────────────────────────
        alvo = pg.get_by_test_id("attack-target")
        if await alvo.count(): await alvo.select_option(label="TESTE Inimigo")
        botao = pg.get_by_role("button", name="Rolar Ataque")
        if await botao.count():
            await botao.first.evaluate("el=>el.click()"); await dados(pg, 5)
        print("HP inimigo após ataque:", await st('teste-ini', 'hpCurrent'))
        logs = await pg.evaluate("window.__logStore?window.__logStore.getState().logs.slice(0,10).map(l=>l.message):null")
        print("LOG ATAQUE:", json.dumps(logs, ensure_ascii=False)[:2000])
        await pg.screenshot(path=S + "4_ataque.png")
        print("gravações bloqueadas:", len(blocked))
        await b.close()
asyncio.run(main())
