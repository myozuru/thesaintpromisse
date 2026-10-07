"""Guilda: fundar pela aba Guilda do Diário, convidar membro, aceitar quest
pela guilda no mural, renome ao concluir (+10) e ao falhar (metade).
Tudo só no navegador (gravações e sockets bloqueados)."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
S = "/tmp/browser/guilda/"; pathlib.Path(S).mkdir(parents=True, exist_ok=True)

SETUP = """async ()=>{
  const cs=window.__charStore, ms=window.__mapStore;
  const {useQuestStore}=await import('/src/stores/useQuestStore.ts');
  const {useRoleStore}=await import('/src/stores/useRoleStore.ts');
  const D=ms.getState().gridConfig.dpi||50, pid=window.__profileStore.getState().activeProfileId;
  const src=cs.getState().characters[0];
  const mk=(id,o)=>({...src,temporary:false,id,conditions:[],activeConditions:[],...o});
  cs.setState({characters:[mk('p1',{name:'TESTE Ana',profileId:pid,category:'PLAYER'}),
     mk('p2',{name:'TESTE Bruno',profileId:'outro',category:'PLAYER'})]});
  ms.setState({entities:{e1:{id:'e1',characterId:'p1',type:'character',x:0,y:0,w:D,h:D,label:'Ana'},
     e2:{id:'e2',characterId:'p2',type:'character',x:0,y:2*D,w:D,h:D,label:'Bruno'},
     mur:{id:'mur',shape:'RECT',x:D,y:D,w:D,h:D,label:'Mural',layer:'tokens',locked:true,rotation:0,color:'#888'}}, selectedIds:[]});
  const m=useQuestStore.getState().criarMural('Mural da Vila'); useQuestStore.getState().atualizarMural(m.id,{entityId:'mur'});
  const q=useQuestStore.getState().criarQuest('Caçar o lobo');
  useQuestStore.getState().atualizarQuest(q.id,{descricao:'Um lobo ronda a vila.',recompensa:{valor:100,currencyId:'yen',itens:[]}});
  useRoleStore.setState({role:'PLAYER'});
  return {quest:q.id};
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True); c = await b.new_context(viewport={"width": 1280, "height": 1800}); pg = await c.new_page()
        async def guard(route):
            r = route.request
            if r.method != "GET" and "supabase" in r.url and "/auth/" not in r.url: await route.abort()
            else: await route.continue_()
        await c.route("**/*", guard); await c.route_web_socket("**/*", lambda ws: ws.close())
        await pg.goto("http://localhost:8080")
        await pg.evaluate(f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})")
        await pg.goto("http://localhost:8080"); await pg.wait_for_timeout(6000)
        await pg.mouse.click(640, 400); await pg.wait_for_timeout(2000)
        mapa = pg.get_by_text("Mapa", exact=True)
        if await mapa.count(): await mapa.first.click(force=True); await pg.wait_for_timeout(2000)
        ids = await pg.evaluate(SETUP); await pg.wait_for_timeout(1200)

        # Selecionar o mural para abrir o painel e então o Diário
        await pg.evaluate("window.__mapStore.setState({selectedIds:['mur']})"); await pg.wait_for_timeout(1000)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500)
        await pg.evaluate("window.__mapStore.setState({selectedIds:[]})"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=S + "0_antes_diario.png")
        print("overlay presente:", await pg.locator("[data-npc-overlay]").count())
        print("botões no overlay:", await pg.locator("[data-npc-overlay] button").all_inner_texts() if await pg.locator("[data-npc-overlay]").count() else None)
        diario_btn = pg.locator("[data-npc-overlay] button", has_text="Diário")
        print("botão Diário visível:", await diario_btn.count() > 0)
        await diario_btn.first.click(); await pg.wait_for_timeout(800)
        await pg.get_by_role("button", name="Guilda", exact=True).click(); await pg.wait_for_timeout(500)
        await pg.screenshot(path=S + "1_aba_guilda.png")

        # Fundar guilda
        await pg.get_by_label("Nome da guilda").fill("Bando do Falcão")
        await pg.get_by_role("button", name="Fundar").click(); await pg.wait_for_timeout(600)
        await pg.screenshot(path=S + "2_fundada.png")
        print("guilda fundada:", await pg.get_by_text("Bando do Falcão").count() > 0)
        print("nível exibido:", await pg.get_by_text("Desconhecida").count() > 0)

        # Convidar Bruno (clicar no chip dele)
        await pg.get_by_role("button", name="☐ TESTE Bruno").click(); await pg.wait_for_timeout(500)
        membros = await pg.evaluate("""async()=>{const m=await import('/src/stores/useQuestStore.ts');
          const g=Object.values(m.useQuestStore.getState().guildas)[0]; return g?g.membros:null}""")
        print("membros após convite:", membros)
        await pg.screenshot(path=S + "3_membros.png")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500)

        # Mural já deve estar aberto; se fechou, reabrir
        if await pg.locator(f"[data-cartaz='{ids['quest']}']").count() == 0:
            await pg.evaluate("window.__mapStore.setState({selectedIds:['mur']})"); await pg.wait_for_timeout(1000)
        await pg.locator(f"[data-cartaz='{ids['quest']}']").click(); await pg.wait_for_timeout(500)
        btn_guilda = pg.get_by_role("button", name=lambda n: n and "Aceitar pela guilda" in n)
        print("botão aceitar pela guilda:", await btn_guilda.count() > 0)
        await pg.screenshot(path=S + "4_mural_guilda.png")
        await btn_guilda.first.click(); await pg.wait_for_timeout(600)
        aceita = await pg.evaluate(f"""async()=>{{const m=await import('/src/stores/useQuestStore.ts');
          const q=m.useQuestStore.getState().quests['{ids['quest']}']; return {{aceitaPor:q.aceitaPor, guildaId:q.guildaId, status:q.status}}}}""")
        print("quest aceita pela guilda:", json.dumps(aceita, ensure_ascii=False))
        await pg.screenshot(path=S + "5_aceita_guilda.png")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)

        # Mestre conclui -> renome +10; depois falhar outra -> metade
        r = await pg.evaluate(f"""async()=>{{
          const {{useRoleStore}}=await import('/src/stores/useRoleStore.ts');
          const {{useQuestStore}}=await import('/src/stores/useQuestStore.ts');
          const a=await import('/src/lib/economia/acoesQuest.ts');
          useRoleStore.setState({{role:'MASTER'}});
          a.concluirQuest('{ids['quest']}');
          const g1=Object.values(useQuestStore.getState().guildas)[0];
          const q2=useQuestStore.getState().criarQuest('Segunda');
          useQuestStore.getState().atualizarQuest(q2.id,{{aceitaPor:['p1','p2'],guildaId:g1.id,status:'aceita'}});
          a.falharQuest(q2.id);
          const g2=Object.values(useQuestStore.getState().guildas)[0];
          return {{renomeAposConcluir:g1.renome, renomeAposFalhar:g2.renome}};
        }}""")
        print("renome:", json.dumps(r, ensure_ascii=False))

        # Diário do jogador mostra a quest aceita pela guilda
        await pg.evaluate("""async()=>{const {useRoleStore}=await import('/src/stores/useRoleStore.ts');useRoleStore.setState({role:'PLAYER'})}""")
        if await pg.locator("[data-npc-overlay] button", has_text="Diário").count() == 0:
            await pg.evaluate("window.__mapStore.setState({selectedIds:['mur']})"); await pg.wait_for_timeout(1000)
        await pg.locator("[data-npc-overlay] button", has_text="Diário").first.click(); await pg.wait_for_timeout(800)
        print("quest no diário:", await pg.get_by_text("Caçar o lobo").count() > 0)
        await pg.get_by_role("button", name="Guilda", exact=True).click(); await pg.wait_for_timeout(400)
        print("renome visível na aba:", await pg.get_by_text("Renome 5").count() > 0)
        await pg.screenshot(path=S + "6_diario_final.png")
        await b.close()

asyncio.run(main())
