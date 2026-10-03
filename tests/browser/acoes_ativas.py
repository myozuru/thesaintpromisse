"""HUD real (navegador) — Réplicas materializáveis (OMNI). Fichas/peças/combate só no navegador (gravações e sockets
bloqueados); somem ao fechar."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/ativas/"
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
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:4*D,y:0,w:D,h:D}}});
          cb.setState({inCombat:true,combatId:'cb-replica',round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0,movementUsedByChar:{}});
          window.__D=D; return {D};
        }"""))
        await pg.wait_for_timeout(1500)
        st = lambda i, f: pg.evaluate(f"window.__charStore.getState().characters.find(c=>c.id==='{i}').{f}")
        await pg.evaluate("""()=>{
          const inv=window.__inventoryStore; inv.setState({items:{}});
          inv.getState().add('teste-esp',{id:'lamina',versao:1,nome:'Lâmina Cobiçosa',categoria:'item',descricao:'',tags:[],duracao:{tipo:'permanente'},custos:[],gatilhos:[],criadoEm:0,atualizadoEm:0,
            acoesAtivas:[
              {id:'v',nome:'Vingança Agulhada',acao:'comum',custoPE:'4',alcanceM:6,teste:'tr',tr:'fortitude',cd:'40',metadeNoSucesso:true,dano:'6d8',tipoDano:'Impacto',efeitos:[{tipo:'puxar',metros:4.5},{tipo:'condicao',condicao:'exposto',rodadas:1}]},
              {id:'c',nome:'Corte da Injustiça',acao:'comum',custoPE:'10',alcanceM:0,teste:'nenhum',dano:'2d8',tipoDano:'Força',dadosPorCarga:'1d8',consumirContador:{nome:'rancor',minimo:1}}]});
        }""")
        for nome in ["Fichas", "FICHAS"]:
            t = pg.get_by_text(nome, exact=True)
            if await t.count(): await t.first.click(force=True); break
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(2500)
        sec = pg.get_by_test_id("acoes-ativas-section")
        print("SEÇÃO ações ativas:", await sec.count())
        await sec.first.scroll_into_view_if_needed(); await sec.first.screenshot(path=S+"1_secao.png")
        await sec.get_by_test_id("acao-ativa-alvo").first.select_option(label="TESTE Inimigo")
        usar = lambda n: sec.get_by_test_id("acao-ativa-"+n).get_by_role("button", name="Usar").click()
        ex = lambda: pg.evaluate("window.__mapStore.getState().entities.e2.x/window.__D")
        print("ANTES → PE", await st('teste-esp','peCurrent'), "HP alvo", await st('teste-ini','hpCurrent'), "casa alvo", await ex())
        await usar("Vingança Agulhada"); await dados(pg, 6)
        print("VINGANÇA (CD 40 = falha) → PE", await st('teste-esp','peCurrent'), "ação", await st('teste-esp','actionsCurrent'), "HP alvo", await st('teste-ini','hpCurrent'), "casa alvo", await ex(),
              "condições", await pg.evaluate("window.__charStore.getState().characters.find(c=>c.id==='teste-ini').activeConditions.map(c=>c.conditionId)"))
        await usar("Corte da Injustiça"); await pg.wait_for_timeout(800)
        print("CORTE sem ação/cargas → PE", await st('teste-esp','peCurrent'))
        await pg.evaluate("window.__charStore.getState().updateCharacter('teste-esp',{actionsCurrent:1,omniCounters:{rancor:3}})")
        hp0 = await st('teste-ini','hpCurrent')
        await usar("Corte da Injustiça"); await dados(pg, 6)
        print("CORTE com 3 cargas → PE", await st('teste-esp','peCurrent'), "rancor", await st('teste-esp','omniCounters.rancor'), "dano", hp0 - await st('teste-ini','hpCurrent'))
        logs = await pg.evaluate("window.__logStore.getState().logs.slice(0,6).map(l=>l.message)")
        print("LOG:", json.dumps(logs, ensure_ascii=False)[:2500])
        await sec.first.screenshot(path=S+"2_final.png")
        await pg.evaluate("window.__inventoryStore.getState().setState?0:0; window.__inventoryStore.setState({items:{}})")
        print("gravações bloqueadas:", len(blocked))
        await b.close()
asyncio.run(main())
