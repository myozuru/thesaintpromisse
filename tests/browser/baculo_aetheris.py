"""Báculo Aetheris em combate real no navegador. Fichas/peças/combate só no navegador (gravações e sockets
bloqueados); somem ao fechar. Uso: python tests/browser/baculo_aetheris.py"""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/aeth/"
pathlib.Path(S).mkdir(parents=True, exist_ok=True)
RAIZ = pathlib.Path(__file__).resolve().parents[2]

async def dados(pg, n=5):
    for _ in range(n):
        ps = pg.get_by_role("button", name="Passar e continuar")
        if await ps.count(): await ps.first.click(); await pg.wait_for_timeout(1200)
        tr = pg.get_by_text("Clique ou segure")
        if await tr.count(): await tr.first.click(); await pg.wait_for_timeout(3500)
        else: await pg.wait_for_timeout(700)

SNAP = """(()=>{const g=i=>window.__charStore.getState().characters.find(c=>c.id===i);const a=g('teste-esp'),t=g('teste-ini');
return {PE:a.peCurrent,acao:a.actionsCurrent,bonus:a.bonusActionsCurrent,usos:a.omniUsosCena,hpAlvo:t.hpCurrent,cond:(t.activeConditions||[]).map(c=>c.conditionId)}})()"""
RESOLVE = """async()=>{const m=await import('/src/stores/useAlvoMapaStore.ts');if(m.useAlvoMapaStore.getState().pending){m.terminarAlvoMapa(['teste-ini']);return 'alvo'}
const ms=window.__mapStore.getState();if(ms.pendingAoEPlacement){ms.resolveAoEPlacement({id:'t',kind:'circle',x:4*window.__D+window.__D/2,y:window.__D/2,rotation:0,length:3*window.__D,width:0,color:'red',opacity:.3});return 'area'};return ''}"""

async def usar(pg, nome):
    await pg.screenshot(path=S+"antes_"+nome[:5]+".png")
    await pg.get_by_text("Fichas", exact=True).first.click(force=True, timeout=8000); await pg.wait_for_timeout(1000)
    if not await pg.get_by_test_id("acao-ativa-" + nome).locator("visible=true").count():
        await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(1200)
    card = pg.get_by_test_id("acao-ativa-" + nome).locator("visible=true").first
    await card.locator("button[aria-expanded]").click(); await pg.wait_for_timeout(300)
    bt = card.get_by_role("button", name="Usar")
    if not await bt.count() or await bt.is_disabled():
        print(nome, "→ BLOQUEADO:", (await card.inner_text())[:300].replace("\n", " | "))
        return
    if False:
        print(nome, "→ BOTÃO BLOQUEADO"); return
    await bt.click(no_wait_after=True)
    for _ in range(8):
        await pg.wait_for_timeout(600)
        r = await pg.evaluate(RESOLVE)
        if r: print("  escolha:", r)
    await dados(pg, 5); await pg.wait_for_timeout(13000); await dados(pg, 2)
    print(nome, "→", await pg.evaluate(SNAP))
    print("  log:", json.dumps(await pg.evaluate("window.__logStore.getState().logs.slice(0,2).map(l=>l.message)"), ensure_ascii=False)[:500])
    await pg.screenshot(path=S + nome[:6] + ".png")

async def main():
    ent = json.load(open(RAIZ / "public/omni-presets/baculo-aetheris.json"))["entidades"][0]
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
        await pg.goto("http://localhost:8080")
        await pg.evaluate("([k,v])=>{localStorage.setItem(k,v);localStorage.setItem('mapa.tutorial.seen.v1','1')}",
                          [os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'], os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON']])
        await pg.goto("http://localhost:8080")
        await pg.wait_for_function("!!(window.__charStore && window.__mapStore && window.__combatStore && window.__profileStore && window.__inventoryStore)", timeout=90000)
        await pg.wait_for_function("window.__charStore.getState().characters.some(c=>Array.isArray(c.passives)&&Array.isArray(c.spells))", timeout=90000); await pg.mouse.click(640, 400); await pg.get_by_text("Fichas", exact=True).first.wait_for(timeout=60000)
        await pg.evaluate("""(e)=>{
          const cs=window.__charStore, ms=window.__mapStore, cb=window.__combatStore;
          const D=(ms.getState().gridConfig.dpi||50); window.__D=D;
          const pid=window.__profileStore.getState().activeProfileId;
          const all=cs.getState().characters;const src=all.find(c=>!c.temporary&&Array.isArray(c.passives)&&Array.isArray(c.spells)&&Array.isArray(c.skills))||all[0];
          const mk=(id,o)=>({...src,temporary:false,id,...o});
          const base={escCurrent:0,escMax:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,chosenSpecAbilities:[],attacksThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1,specAbilityUsage:{},omniUsosCena:{},omniAtivos:[]};
          const t=mk('teste-esp',{...base,name:'TESTE Especialista',profileId:pid,category:'PLAYER',level:5,peCurrent:60,peMax:60,hpCurrent:40,hpMax:40,movement:9,
            mainHandWeaponName:e.nome,offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            attributes:[{id:'a1',name:'Força',value:16},{id:'a2',name:'Destreza',value:16},{id:'a3',name:'Sabedoria',value:18}]});
          const e1=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:5});
          cs.setState({characters:[t,e1]});
          ms.setState({entities:{e1:{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'teste-ini',type:'character',x:4*D,y:0,w:D,h:D}}});
          cb.setState({inCombat:true,combatId:'cb-aeth',round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0,movementUsedByChar:{}});
          const inv=window.__inventoryStore; inv.setState({items:{}}); inv.getState().add('teste-esp',e);
        }""", ent)
        await pg.wait_for_timeout(1500)
        print("ANTES", await pg.evaluate(SNAP))
        print("CUSTOS", await pg.evaluate("""async(e)=>{const m=await import('/src/lib/omni/custosAtivos.ts');const u=window.__charStore.getState().characters.find(c=>c.id==='teste-esp');
          return e.acoesAtivas.map(a=>{const r=m.planejarCustosAtivos(a,u,0,{armaNome:e.nome,entidadeId:e.id});return a.nome+': '+(r.ok?'ok':r.reason)})}""", ent))
        for nome in ["Trono das Nuvens", "Réquiem dos Céus", "Réquiem dos Céus"]:
            await pg.evaluate("window.__charStore.getState().updateCharacter('teste-esp',{actionsCurrent:1,bonusActionsCurrent:1})")
            await usar(pg, nome)
        print("gravações bloqueadas:", len(blocked))
        await b.close()
asyncio.run(main())
