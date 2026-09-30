"""HUD real (navegador) — Especialista nv 4 parte C: Preparo Imediato,
Recarga Rápida (munição) e Uso Rápido. Fichas/peças/combate/itens só no
navegador (gravações e sockets bloqueados); somem ao fechar."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/hud_nv4c/"
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
            mainHandWeaponName:'Pistola',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,weaponAmmo:{},
            attributes:[{id:'a1',name:'Força',value:16},{id:'a2',name:'Destreza',value:16},{id:'a3',name:'Sabedoria',value:14}],
            chosenSpecAbilities:['ec-preparo-imediato','ec-recarga-rapida','ec-uso-rapido'].map(abilityId=>({abilityId,chosenAtLevel:4}))});
          const e1=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5});
          cs.setState({characters:[t,e1]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:3*D,y:0,w:D,h:D}}});
          window.__itemStore && window.__itemStore.setState({items:[{id:'it1',name:'TESTE Poção',category:'Consumível',description:'',weight:0,cost:0,slots:0,quantity:3,slotType:'inventory',bonusHP:0,bonusPE:0,bonusESC:0,bonusRD:0,bonusRdByType:{},bonusSlots:0,bonusCA:0,bonusDC:0,bonusActions:0,bonusBonusActions:0,assignedTo:['teste-esp'],isFood:false}]});
          cb.setState({inCombat:true,combatId:'cb-hud-c',round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0,movementUsedByChar:{}});
          window.__D=D; return {D, itens: !!window.__itemStore};
        }"""))
        await pg.wait_for_timeout(1500)
        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")

        # ── Preparo Imediato: pergunta na iniciativa ──────────────────────────
        prompt = pg.get_by_test_id("preparo-imediato-prompt")
        print("PROMPT INICIATIVA:", await prompt.count())
        await pg.screenshot(path=S + "1_prompt_iniciativa.png")
        if await prompt.count():
            await pg.get_by_test_id("preparo-imediato-bonus").click(); await pg.wait_for_timeout(600)
        print("PREPARO após preparar:", await st('teste-esp', 'preparoCurrent'),
              "PREPARADA:", await st('teste-esp', 'prontidaoPreparada'))

        for nome in ["Fichas", "FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count(): await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2500)

        sec = pg.get_by_test_id("preparo-imediato-section")
        print("SEÇÕES (preparo/recarga/uso):", await sec.count(),
              await pg.get_by_test_id("recarga-section").count(),
              await pg.get_by_test_id("uso-rapido-section").count())
        if await sec.count():
            await sec.first.scroll_into_view_if_needed()
        await pg.screenshot(path=S + "2_secoes.png")

        # ── Disparar a ação preparada (no próprio turno: não gasta reação) ────
        if await pg.get_by_test_id("preparo-imediato-disparar").count():
            await pg.get_by_test_id("preparo-imediato-disparar").evaluate("el=>el.click()")
            await pg.wait_for_timeout(600)
        print("AÇÃO BÔNUS após disparar:", await st('teste-esp', 'bonusActionsCurrent'),
              "REAÇÃO:", await st('teste-esp', 'reactionsCurrent'),
              "PREPARADA:", await st('teste-esp', 'prontidaoPreparada'))

        # ── Munição: tiros antes/depois de um ataque real ─────────────────────
        ammo = pg.get_by_test_id("ammo-Pistola")
        await ammo.scroll_into_view_if_needed()
        print("MUNIÇÃO inicial:", (await ammo.text_content()).strip())
        alvo = pg.get_by_test_id("attack-target")
        if await alvo.count(): await alvo.select_option(label="TESTE Inimigo")
        botao = pg.get_by_role("button", name="Rolar Ataque")
        if await botao.count():
            await botao.first.evaluate("el=>el.click()"); await dados(pg, 4)
        print("MUNIÇÃO após ataque:", await st('teste-esp', 'weaponAmmo'),
              "HP inimigo:", await st('teste-ini', 'hpCurrent'))
        await pg.get_by_test_id("recarga-section").scroll_into_view_if_needed()
        await pg.screenshot(path=S + "3_municao.png")

        # ── Recarregar (Pistola é Leve → com a habilidade vira Ação Livre) ────
        await pg.evaluate("window.__charStore.getState().updateCharacter('teste-esp',{weaponAmmo:{Pistola:0}})")
        await pg.wait_for_timeout(500)
        print("DESCARREGADA:", (await pg.get_by_test_id("ammo-Pistola").text_content()).strip())
        await pg.get_by_test_id("recarregar-Pistola").evaluate("el=>el.click()"); await pg.wait_for_timeout(600)
        print("APÓS RECARGA:", await st('teste-esp', 'weaponAmmo'),
              "ações:", await st('teste-esp', 'actionsCurrent'),
              "bônus:", await st('teste-esp', 'bonusActionsCurrent'))
        await pg.screenshot(path=S + "4_recarga.png")

        # ── Uso Rápido: 1 PE por item adicional, 1 por turno ──────────────────
        uso = pg.get_by_test_id("uso-rapido-section")
        if await uso.count():
            await uso.scroll_into_view_if_needed()
            await pg.get_by_test_id("uso-rapido-item").select_option(label="TESTE Poção (x3)")
            await pg.get_by_test_id("uso-rapido-usar").evaluate("el=>el.click()"); await pg.wait_for_timeout(700)
            print("PE após Uso Rápido:", await st('teste-esp', 'peCurrent'),
                  "item:", await pg.evaluate("window.__itemStore.getState().items[0].quantity"),
                  "bloqueado 2º:", await pg.get_by_test_id("uso-rapido-usar").is_disabled())
            await pg.screenshot(path=S + "5_uso_rapido.png")

        logs = await pg.evaluate("window.__logStore?window.__logStore.getState().logs.slice(0,14).map(l=>l.message):null")
        print("LOG:", json.dumps(logs, ensure_ascii=False)[:2500])
        print("gravações bloqueadas:", len(blocked))
        await b.close()
asyncio.run(main())
