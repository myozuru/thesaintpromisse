import asyncio,json,os
from playwright.async_api import async_playwright
import pathlib; S="/tmp/browser/hud_especialista/"; pathlib.Path(S).mkdir(parents=True,exist_ok=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True); c=await b.new_context(viewport={"width":1280,"height":1800}); pg=await c.new_page()
    blocked=[]
    async def guard(route):
      r=route.request
      if r.method!="GET" and "supabase" in r.url and "/auth/" not in r.url:
        blocked.append(r.method+" "+r.url[:80]); await route.abort()
      else: await route.continue_()
    await c.route("**/*",guard)
    await c.route_web_socket("**/*", lambda ws: ws.close())
    pg.on("console", lambda m: m.type=="error" and print("CONSOLE",m.text[:150]))
    await pg.goto("http://localhost:8080")
    await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
    await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(5000)
    await pg.mouse.click(640,400); await pg.wait_for_timeout(4000)
    info=await pg.evaluate("""()=>{
      const cs=window.__charStore, ms=window.__mapStore, cb=window.__combatStore;
      const g=ms.getState().gridConfig; const D=g.dpi||50;
      const pid=window.__profileStore.getState().activeProfileId; const src=cs.getState().characters.find(c=>!c.temporary)||cs.getState().characters[0]; const mk=(id,o)=>({...src, temporary:false, id, ...o});
      const base={hpCurrent:30,hpMax:30,escCurrent:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,defense:12,chosenSpecAbilities:[],attacksThisTurn:0,weaponSwapsThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1};
      const t=mk('teste-esp',{...base,name:'TESTE Especialista',profileId:pid,category:'PLAYER',characterClass:'Feiticeiro',specialization:'Especialista em Combate',level:4,peCurrent:20,peMax:20,mainHandWeaponName:'Pistola',offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
        chosenSpecAbilities:[{abilityId:'ec-pistoleiro-iniciado',chosenAtLevel:2},{abilityId:'ec-precisao-definitiva',chosenAtLevel:3},{abilityId:'ec-posicionamento-ameacador',chosenAtLevel:4},{abilityId:'ec-flanqueador-superior',chosenAtLevel:4}]});
      const e=mk('teste-ini',{...base,name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,rd:0,defense:10});
      const a=mk('teste-ali',{...base,name:'TESTE Aliado',category:'PLAYER'});
      cs.setState({characters:[t,e,a]});
      ms.setState({entities:{'e1':{id:'e1',characterId:'teste-esp',type:'character',x:0,y:0,w:D,h:D},'e2':{id:'e2',characterId:'teste-ini',type:'character',x:4*D,y:0,w:D,h:D},'e3':{id:'e3',characterId:'teste-ali',type:'character',x:5*D,y:0,w:D,h:D}}});
      cb.setState({inCombat:true,round:1,initiativeOrder:[{charId:'teste-esp'},{charId:'teste-ini'}],currentTurnIndex:0});
      return {pid, n:cs.getState().characters.length, D};
    }""")
    print(info); await pg.wait_for_timeout(2000)
    await pg.screenshot(path=S+"c1.png")
    await pg.get_by_text("TESTE Especialista").first.click(); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=S+"c2.png")
    sel=pg.locator("select").filter(has=pg.locator("option[value='teste-ini']")).first
    print("target options:", await pg.locator("select option").all_inner_texts())
    await sel.select_option("teste-ini"); await pg.wait_for_timeout(500)
    ps=pg.locator("select").filter(has_text="0 PE").first
    await ps.select_option(index=1); await pg.wait_for_timeout(500)
    panel=pg.get_by_text("PAINEL DE ATAQUE").locator("xpath=ancestor::div[3]")
    await pg.get_by_text("Pistoleiro Iniciado").first.scroll_into_view_if_needed()
    await pg.screenshot(path=S+"c3.png")
    await pg.get_by_role("button",name="Rolar Ataque").first.click(); await pg.wait_for_timeout(9000)
    await pg.screenshot(path=S+"c4.png")
    print("PE now:", await pg.evaluate("window.__charStore.getState().characters.find(c=>c.id==='teste-esp').peCurrent"))
    print("jam:", await pg.evaluate("JSON.stringify(window.__charStore.getState().characters.find(c=>c.id==='teste-esp').jammedWeapons||null)"))
    await pg.get_by_text("Clique ou segure").first.click(); await pg.wait_for_timeout(9000); await pg.screenshot(path=S+"c5.png")
    for bt in await pg.get_by_role("button",name="Rolar Dano").all():
      await bt.click(); break
    await pg.wait_for_timeout(2000)
    tr=pg.get_by_text("Clique ou segure")
    if await tr.count(): await tr.first.click(); await pg.wait_for_timeout(9000)
    await pg.wait_for_timeout(6000)
    for k in range(3):
      tr=pg.get_by_text("Clique ou segure")
      if await tr.count(): await tr.first.click(); await pg.wait_for_timeout(6000)
    bts=pg.get_by_role("button",name="Rolar Dano")
    print("rolar dano count", await bts.count(), [await bts.nth(i).is_enabled() for i in range(await bts.count())])
    pb=pg.get_by_text("PAINEL DE ATAQUE").locator("xpath=ancestor::div[.//button[normalize-space()='Rolar Dano']][1]").get_by_role("button",name="Rolar Dano")
    if await pb.count():
      await pb.first.click(force=True); await pg.wait_for_timeout(3000)
    await pg.screenshot(path=S+"c6.png")
    print("HP ini:", await pg.evaluate("window.__charStore.getState().characters.find(c=>c.id==='teste-ini').hpCurrent"))
    print("LOG:", await pg.evaluate("(window.__logStore?window.__logStore.getState().logs.slice(-8).map(l=>l.message):null)"))
    print("FLANK:", await pg.evaluate("""async()=>{const m=await import('/src/lib/flanqueadorSuperior.ts');const cs=window.__charStore.getState().characters;const ms=window.__mapStore.getState();const r={};r.dentro=m.penalidadeTRFlanqueado(cs.find(c=>c.id==='teste-ini'),cs,ms.entities,ms.gridConfig);
      const D=ms.gridConfig.dpi||50; window.__mapStore.setState({entities:{...ms.entities,e1:{...ms.entities.e1,x:-60*D}}});const m2=window.__mapStore.getState();r.dist=m.__proto__?0:0; const t=await import('/src/lib/touchRange.ts'); r.distFora=t.charsDistanceMeters('teste-esp','teste-ini',m2.entities,m2.gridConfig); r.e1=m2.entities.e1.x; r.fora=m.penalidadeTRFlanqueado(cs.find(c=>c.id==='teste-ini'),cs,m2.entities,m2.gridConfig);
      window.__mapStore.setState({entities:{...m2.entities,e1:{...m2.entities.e1,x:0,hidden:true}}});const m3=window.__mapStore.getState();r.furtivo=m.penalidadeTRFlanqueado(cs.find(c=>c.id==='teste-ini'),cs,m3.entities,m3.gridConfig);return r}"""))
    body=await pg.inner_text("body"); import re
    print([l for l in body.split("\n") if re.search("Ataque|acert|Dano|NaN|Defesa|🗡|💥|Precis",l)][:40])
    print("blocked writes:",len(blocked))
    await b.close()
asyncio.run(main())
