"""Combate real (navegador) — Portas da Morte, Ferimento Complexo e Suporte nv4 "No Último Segundo".
Fichas/peças/combate só no navegador (gravações e sockets bloqueados)."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
S="/tmp/browser/portas/"; pathlib.Path(S).mkdir(parents=True, exist_ok=True)
SETUP="""(p)=>{
  const cs=window.__charStore, ms=window.__mapStore, cb=window.__combatStore;
  window.__roleStore.setState({role:'MASTER'}); window.__logStore.setState({logs:[]});
  const D=ms.getState().gridConfig.dpi||50, pid=window.__profileStore.getState().activeProfileId;
  const src=cs.getState().characters.find(c=>!c.temporary)||cs.getState().characters[0];
  const base={escCurrent:0,conditions:[],activeConditions:[],rd:0,chosenSpecAbilities:[],actionsCurrent:1,actionsMax:1,reactionsCurrent:1,bonusActionsCurrent:1,portasMorte:undefined,falhasMorte:0,ferimentoPendente:undefined,ferimentosComplexos:[],ultimoSegundoAtivo:false};
  const mk=(id,o)=>({...src,temporary:false,id,...base,...o});
  cs.setState({characters:[
    mk('pm-sup',{name:'TESTE Suporte',profileId:pid,category:'PLAYER',level:4,hpCurrent:40,hpMax:40,chosenSpecAbilities:[{abilityId:'sup-no-ultimo-segundo',chosenAtLevel:4}]}),
    mk('pm-cai',{name:'TESTE Caído',profileId:pid,category:'PLAYER',level:4,hpCurrent:20,hpMax:p.hpMax||40}),
    mk('pm-ini',{name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:100,hpMax:100})]});
  ms.setState({entities:{a:{id:'a',characterId:'pm-sup',type:'character',x:p.supX*D,y:0,w:D,h:D},b:{id:'b',characterId:'pm-cai',type:'character',x:0,y:0,w:D,h:D},c:{id:'c',characterId:'pm-ini',type:'character',x:5*D,y:0,w:D,h:D}}});
  cb.setState({turnTimerEnabled:false,turnDurationSec:99999,inCombat:true,round:1,currentTurnIndex:0,
    initiativeOrder:[{charId:'pm-ini',charName:'Inimigo',roll:18,bonus:0,total:18},{charId:'pm-cai',charName:'Caído',roll:15,bonus:0,total:15},{charId:'pm-sup',charName:'Suporte',roll:12,bonus:0,total:12}]});
}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True); c=await b.new_context(viewport={"width":1280,"height":1800}); pg=await c.new_page(); blocked=[]
    async def guard(route):
      r=route.request
      if r.method!="GET" and "supabase" in r.url and "/auth/" not in r.url: blocked.append(r.url); await route.abort()
      else: await route.continue_()
    await c.route("**/*",guard); await c.route_web_socket("**/*",lambda ws: ws.close())
    await pg.goto("http://localhost:8080")
    await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
    await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(6000); await pg.mouse.click(640,400); await pg.wait_for_timeout(2000)
    st=lambda: pg.evaluate("()=>{const g=id=>window.__charStore.getState().characters.find(c=>c.id===id);const x=g('pm-cai'),s=g('pm-sup');const cb=window.__combatStore.getState();return {hp:x.hpCurrent,portas:x.portasMorte,falhas:x.falhasMorte,cond:x.activeConditions.map(a=>a.conditionId),fer:x.ferimentosComplexos.map(f=>f.nome),pend:x.ferimentoPendente,supAtivo:s.ultimoSegundoAtivo,supMov:null,ordem:cb.initiativeOrder.map(e=>e.charId+':'+e.total),rodada:cb.round,log:window.__logStore.getState().logs.slice(-4).map(l=>l.message)}}")
    dano=lambda v: pg.evaluate(f"window.__charStore.getState().applyDamage('pm-cai',{v},'Impacto',{{attackerId:'pm-ini'}})")
    async def dados(n=6):
      for _ in range(n):
        t=pg.get_by_text("Clique ou segure")
        if await t.count(): await t.first.click(force=True); await pg.wait_for_timeout(3500)
        else: await pg.wait_for_timeout(700)
    async def fichas():
      f=pg.get_by_text("Fichas",exact=True)
      if await f.count(): await f.first.click(force=True); await pg.wait_for_timeout(1200)
    async def show(t): print(t, json.dumps(await st(), ensure_ascii=False)[:900])

    # 1-2: cair e sofrer dano nas Portas
    await pg.evaluate(SETUP,{"supX":1}); await pg.evaluate("window.__testRequestStore.setState({requests:[]})"); await pg.wait_for_timeout(800)
    await dano(23); await pg.wait_for_timeout(1500); await show("[1 caiu -3]")
    await dano(4); await pg.wait_for_timeout(1500); await show("[2 dano nas portas]")
    # 3: teste de morte pelo botão na vez dele
    await pg.evaluate("window.__combatStore.setState({currentTurnIndex:1})"); await fichas()
    await pg.screenshot(path=S+"3_card.png")
    bt=pg.get_by_role("button",name="Rolar Teste de Morte")
    print("botão teste de morte:", await bt.count())
    if await bt.count(): await bt.first.click(force=True); await pg.wait_for_timeout(1500); await dados(4)
    await show("[3 teste de morte]")
    print("botão some após rolar:", await pg.get_by_role("button",name="Rolar Teste de Morte").count())
    # 4: No Último Segundo — 2 falhas, vira a rodada
    await pg.evaluate(SETUP,{"supX":1}); await pg.evaluate("window.__testRequestStore.setState({requests:[]})"); await dano(27); await pg.wait_for_timeout(1200)
    await pg.evaluate("window.__charStore.getState().updateCharacter('pm-cai',{portasMorte:{sucessos:0,falhas:2},falhasMorte:2})")
    await pg.evaluate("window.__combatStore.setState({currentTurnIndex:2}); window.__combatStore.getState().nextTurn()"); await pg.wait_for_timeout(1500)
    await show("[4 último segundo]")
    print("   movimento do Suporte:", await pg.evaluate("async()=>{const m=await import('/src/lib/movementBudget.ts');const s=window.__charStore.getState().characters.find(c=>c.id==='pm-sup');return [s.movement, m.effectiveMovement(s)]}"))
    # 5: estabilizar com Medicina (Suporte a 1,5m)
    await fichas(); await pg.screenshot(path=S+"5_card.png")
    med=pg.get_by_role("button",name=__import__('re').compile("Estabilizar com Medicina"))
    print("botões medicina:", await med.count())
    if await med.count():
      await med.first.click(force=True); await pg.wait_for_timeout(2500)
      # O jogador dono do Suporte rola na própria tela; aqui simulamos o resultado do pedido.
      await pg.evaluate("()=>{const s=window.__testRequestStore.getState();const r=s.requests[0];s.setResult(r.id,{d20:5,bonus:5,total:10,rolledAt:Date.now()})}"); await pg.wait_for_timeout(800)
      await show("[5a medicina falhou (10 vs 16)]")
      print("   ação do Suporte gasta:", await pg.evaluate("window.__charStore.getState().characters.find(c=>c.id==='pm-sup').actionsCurrent"))
      await pg.evaluate("()=>{const s=window.__testRequestStore.getState();s.enqueue({charId:'pm-sup',charName:'TESTE Suporte',kind:'skill',testName:'Medicina',dc:16,sourceTag:'estabilizar:pm-cai'});const r=window.__testRequestStore.getState().requests.at(-1);s.setResult(r.id,{d20:15,bonus:5,total:20,rolledAt:Date.now()})}"); await pg.wait_for_timeout(800)
    print("   pedidos:", await pg.evaluate("JSON.stringify(window.__testRequestStore.getState().requests.map(r=>[r.sourceTag,r.dc,r.result&&r.result.total,r.resolutionApplied]))"))
    await show("[5b medicina passou (20 vs 16)]")
    print("   pedido:", await pg.evaluate("JSON.stringify(window.__testRequestStore.getState().requests.map(r=>[r.testName,r.dc,r.result&&r.result.total]))"))
    # 6: estabilizar por cura
    await pg.evaluate(SETUP,{"supX":8}); await dano(30); await pg.wait_for_timeout(1200)
    await pg.evaluate("window.__charStore.getState().applyHealing('pm-cai',5)"); await pg.wait_for_timeout(1200); await show("[6a cura parcial -5]")
    await pg.evaluate("window.__charStore.getState().applyHealing('pm-cai',5)"); await pg.wait_for_timeout(1200); await show("[6b cura até 0]")
    # 7: Medicina fora de 1,5m não aparece
    await pg.evaluate(SETUP,{"supX":8}); await dano(25); await pg.wait_for_timeout(1200); await fichas()
    print("[7 longe] botões medicina:", await pg.get_by_role("button",name=__import__('re').compile("Estabilizar com Medicina")).count())
    # 8: morte massiva
    await pg.evaluate(SETUP,{"supX":1}); await dano(61); await pg.wait_for_timeout(1500); await show("[8 massivo 61 em 40]")
    # 9: 3 falhas = morte
    await pg.evaluate(SETUP,{"supX":1}); await dano(21); await pg.wait_for_timeout(800)
    await pg.evaluate("window.__charStore.getState().updateCharacter('pm-cai',{portasMorte:{sucessos:0,falhas:2}})"); await dano(1); await pg.wait_for_timeout(1500); await show("[9 terceira falha]")
    # 10: ferimento complexo (100 PV máx, 50 de dano)
    await pg.evaluate(SETUP,{"supX":1,"hpMax":100}); await pg.evaluate("window.__charStore.getState().updateCharacter('pm-cai',{hpCurrent:100})")
    await dano(50); await pg.wait_for_timeout(1500); await fichas()
    sor=pg.get_by_role("button",name="Sortear d10"); print("[10] botão sortear:", await sor.count())
    if await sor.count(): await sor.first.click(force=True); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=S+"10_ferimento.png"); await show("[10 ferimento]")
    await dano(49); await pg.wait_for_timeout(1000); await show("[10b 49 de dano — sem ferimento]")
    print("gravações bloqueadas:",len(blocked)); await b.close()
asyncio.run(main())