"""Combate real (navegador) — frases naturais do OMNI num ataque corpo a corpo pela HUD:
"ao acertar cac então aplicar condição condenado por 2 rodadas" e
"ao acertar corpo_a_corpo então causar 1d4 de dano psíquico por contador_rancor" (3 cargas → 3d4).
Fichas/peças/passivas só no navegador (gravações e sockets bloqueados)."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
S="/tmp/browser/natural/"; pathlib.Path(S).mkdir(parents=True, exist_ok=True)
FRASES=["ao acertar cac então aplicar condição condenado por 2 rodadas",
        "ao acertar corpo_a_corpo então causar 1d4 de dano psíquico por contador_rancor"]
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
    await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(6000)
    await pg.mouse.click(640,400); await pg.wait_for_timeout(3000)
    async def montar(cargas, distancia_cells, arma):
      return await pg.evaluate("""async (p)=>{
        const {parseScriptOmni}=await import('/src/lib/omni/compilarNatural.ts');
        const efs=p.frases.flatMap(f=>{const r=parseScriptOmni(f); if((r.erros||[]).length) throw new Error(JSON.stringify(r.erros)); return r.efeitos;});
        const cs=window.__charStore, ms=window.__mapStore, cb=window.__combatStore, os=window.__omniEntStore;
        const D=ms.getState().gridConfig.dpi||50, pid=window.__profileStore.getState().activeProfileId;
        const src=cs.getState().characters.find(c=>!c.temporary)||cs.getState().characters[0];
        os.setState({entidades:{...os.getState().entidades,'tst-nat':{id:'tst-nat',versao:1,nome:'Frases (teste)',categoria:'passiva',descricao:'',tags:[],duracao:{tipo:'permanente'},custos:[],gatilhos:[],combatData:{effectsPassive:efs}}}});
        const base={escCurrent:0,conditions:[],activeConditions:[],exhaustion:0,exhaustionLevel:0,isDead:false,dead:false,rd:0,chosenSpecAbilities:[],attacksThisTurn:0,weaponSwapsThisTurn:0,reactionsCurrent:1,reactionsMax:1,bonusActionsCurrent:1,bonusActionsMax:1,actionsCurrent:1,actionsMax:1,omniCounters:{}};
        const mk=(id,o)=>({...src,temporary:false,id,...base,...o});
        cs.setState({characters:[
          mk('nat-at',{name:'TESTE Atacante',profileId:pid,category:'PLAYER',level:5,hpCurrent:40,hpMax:40,peCurrent:20,peMax:20,defense:12,mainHandWeaponName:p.arma,offHandWeaponName:null,meleeTrained:true,rangedTrained:true,
            omniAtivos:[{id:'v-nat',entidadeId:'tst-nat',categoria:'passiva',instanceId:'i-nat'}],omniCounters:{rancor:p.cargas},
            attributes:[{id:'a1',name:'Força',value:30},{id:'a2',name:'Destreza',value:30}]}),
          mk('nat-ini',{name:'TESTE Inimigo',category:'INIMIGO',hpCurrent:300,hpMax:300,defense:1})]});
        ms.setState({entities:{e1:{id:'e1',characterId:'nat-at',type:'character',x:0,y:0,w:D,h:D},e2:{id:'e2',characterId:'nat-ini',type:'character',x:p.dist*D,y:0,w:D,h:D}}});
        cb.setState({inCombat:true,round:1,initiativeOrder:[{charId:'nat-at'},{charId:'nat-ini'}],currentTurnIndex:0});
        return efs.map(e=>[e.trigger,e.condition,e.formula,e.damageType||'',e.conditionApply?.id||'']);
      }""", {"frases":FRASES,"cargas":cargas,"dist":distancia_cells,"arma":arma})
    async def dados(n):
      for _ in range(n):
        t=pg.get_by_text("Clique ou segure")
        if await t.count(): await t.first.click(force=True); await pg.wait_for_timeout(4000)
        else: await pg.wait_for_timeout(800)
    async def caso(nome,cargas,dist,arma):
      efs=await montar(cargas,dist,arma); print(f"\n[{nome}] efeitos:",efs)
      await pg.wait_for_timeout(1500)
      await pg.get_by_text("TESTE Atacante").first.click(); await pg.wait_for_timeout(1500)
      sel=pg.locator("select").filter(has=pg.locator("option[value='nat-ini']")).first
      await sel.select_option("nat-ini"); await pg.wait_for_timeout(500)
      await pg.get_by_role("button",name="Rolar Ataque").first.click(); await pg.wait_for_timeout(3000)
      await dados(3)
      bt=pg.get_by_role("button",name="Rolar Dano")
      if await bt.count(): await bt.first.click(force=True); await pg.wait_for_timeout(2000)
      await dados(5)
      await pg.screenshot(path=S+nome.replace(" ","_")+".png")
      st=await pg.evaluate("()=>{const g=id=>window.__charStore.getState().characters.find(c=>c.id===id);const i=g('nat-ini');return {hp:i.hpCurrent,cond:i.activeConditions.map(c=>c.conditionId+':'+(c.remainingRounds??c.remainingTurns)),log:window.__logStore.getState().logs.slice(0,6).map(l=>l.message)}}")
      print(json.dumps(st,ensure_ascii=False)[:1400])
    await caso("A cac com 3 cargas",3,1,"Katana")
    await caso("B cac sem cargas",0,1,"Katana")
    await caso("C a distancia nao dispara",3,4,"Pistola")
    print("gravações bloqueadas:",len(blocked)); await b.close()
asyncio.run(main())
