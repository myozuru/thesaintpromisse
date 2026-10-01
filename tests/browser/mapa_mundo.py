"""Mapa do Mundo: zoom, arrastar, ping com botão direito e painel lateral do chefe.

Cria mapa e chefe apenas na sessão do navegador (gravações na nuvem bloqueadas)
e remove tudo ao final.
"""
import asyncio, json, os, base64, pathlib
from playwright.async_api import async_playwright

S = "/tmp/browser/mapa_mundo/"
pathlib.Path(S).mkdir(parents=True, exist_ok=True)

# PNG 256x256 cinza simples gerado em runtime no navegador (canvas) para evitar binário aqui.

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(headless=True)
    c = await b.new_context(viewport={"width": 1400, "height": 1000})
    pg = await c.new_page()
    blocked = []

    async def guard(route):
      r = route.request
      if r.method != "GET" and "supabase" in r.url and "/auth/" not in r.url:
        blocked.append(r.method); await route.abort()
      else:
        await route.continue_()

    await c.route("**/*", guard)
    await c.route_web_socket("**/*", lambda ws: ws.close())
    pg.on("console", lambda m: m.type == "error" and print("CONSOLE", m.text[:160]))

    await pg.goto("http://localhost:8080")
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if key and sess:
      await pg.evaluate(f"localStorage.setItem({json.dumps(key)},{json.dumps(sess)})")
    await pg.goto("http://localhost:8080")
    await pg.wait_for_timeout(5000)
    await pg.mouse.click(700, 420)
    await pg.wait_for_timeout(4000)

    # Abrir aba Mapa > Mapa do Mundo
    await pg.get_by_role("button", name="Mapa").first.click()
    await pg.wait_for_timeout(1500)
    await pg.get_by_text("Mapa do Mundo").first.click()
    await pg.wait_for_timeout(1500)
    await pg.screenshot(path=S + "1-mapa.png")

    print("hooks", await pg.evaluate("!!window.__bossStore && !!window.__roleStore"))
    await pg.evaluate("""() => {
      const st = window.__roleStore.getState();
      (st.setRole || st.select || (()=>{}))('MASTER');
    }""")
    await pg.wait_for_timeout(500)

    created = await pg.evaluate("""() => {
      const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800;
      const g = cv.getContext('2d');
      g.fillStyle = '#1d2b3a'; g.fillRect(0,0,1200,800);
      g.fillStyle = '#86c5a0'; g.fillRect(200,150,400,300);
      g.fillStyle = '#e0b34a'; g.fillRect(700,400,350,250);
      const img = cv.toDataURL('image/png');
      const s = window.__bossStore.getState();
      s.setWorldMap(img);
      const boss = s.create('TESTE Chefe');
      s.update(boss.id, { visivel: true, pv: 60, pvMax: 120, tamanho: 'Enorme', tipo: 'Maldição' });
      s.addMarker(boss.id, 50, 50);
      return boss.id;
    }""")
    print("boss", created)

    box = await pg.locator("img[alt='Mapa do mundo']").first.bounding_box()
    print("mapa visivel", box is not None)

    # Zoom com a roda
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    for _ in range(4):
      await pg.mouse.wheel(0, -200)
      await pg.wait_for_timeout(200)
    await pg.wait_for_timeout(600)
    await pg.screenshot(path=S + "2-zoom.png")
    box2 = await pg.locator("img[alt='Mapa do mundo']").first.bounding_box()
    print("largura antes/depois:", round(box["width"]), round(box2["width"]))

    # Botão direito marca o local
    await pg.mouse.click(box["x"] + 300, box["y"] + 200, button="right")
    await pg.wait_for_timeout(500)
    print("pings:", await pg.locator("span.animate-ping").count())
    await pg.screenshot(path=S + "3-ping.png")

    # Resetar enquadramento e abrir a ficha pelo ícone
    await pg.get_by_title("Enquadrar").first.click()
    await pg.wait_for_timeout(600)
    await pg.get_by_title("TESTE Chefe").first.click()
    await pg.wait_for_timeout(1200)
    await pg.screenshot(path=S + "4-painel.png")
    body = await pg.inner_text("body")
    print("painel aberto:", "Vitalidade" in body, "dialogos:", await pg.locator("[role=dialog]").count())
    print("PV visivel:", "60" in body and "120" in body)

    # Jogador: campos ocultos
    await pg.evaluate("""(id) => {
      const s = window.__bossStore.getState();
      s.update(id, { revelado: { pv: true } });
      const st = window.__roleStore.getState();
      (st.setRole || st.select)('PLAYER');
    }""", created)
    await pg.wait_for_timeout(1200)
    await pg.screenshot(path=S + "5-jogador.png")
    body = await pg.inner_text("body")
    print("jogador ve ??? :", body.count("???"))

    # Limpeza
    await pg.evaluate("""(id) => { const s = window.__bossStore.getState(); s.remove(id); s.setWorldMap(null); }""", created)
    print("gravacoes bloqueadas:", len(blocked))
    await b.close()

asyncio.run(main())
