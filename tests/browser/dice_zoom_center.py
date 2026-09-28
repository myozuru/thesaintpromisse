"""Teste de navegador: rolagem dramática real de um d20 com foco no dado.

Verifica que o dado fica centralizado na tela em todos os quadros do zoom
final (depois que ele assenta). Uso:
    python tests/browser/dice_zoom_center.py [--url http://localhost:8080] [--drama 3]
Sai com código 1 se falhar.
"""
import argparse, asyncio, json, sys
from playwright.async_api import async_playwright

TOLERANCE = 0.02  # distância máx. do centro, em coordenadas de tela (-1..1)


async def main(url: str, drama: int, timeout_s: int) -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = await (await browser.new_context(viewport={"width": 900, "height": 700})).new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(f"{url}/dice-lab?drama={drama}", wait_until="domcontentloaded")
        await page.wait_for_function("window.__diceLab && window.__diceLab.ready()", timeout=timeout_s * 1000)
        await page.evaluate("window.__diceLab.roll()")
        # Espera assentar e ainda capturar ~2s de zoom final.
        await page.wait_for_function(
            "(() => { const p = window.__diceZoomProbe; const s = p.filter(f => f.settled);"
            " return s.length > 0 && s[s.length-1].t - s[0].t > 2; })()",
            timeout=timeout_s * 1000,
        )
        frames = await page.evaluate("window.__diceZoomProbe")
        await page.screenshot(path="/tmp/dice_zoom_center.png")
        await browser.close()

    settled = [f for f in frames if f["settled"]]
    worst = max(settled, key=lambda f: (f["x"] ** 2 + f["y"] ** 2) ** 0.5)
    worst_err = (worst["x"] ** 2 + worst["y"] ** 2) ** 0.5
    all_err = max((f["x"] ** 2 + f["y"] ** 2) ** 0.5 for f in frames)
    print(json.dumps({
        "frames_total": len(frames), "frames_final_zoom": len(settled),
        "fov_start": settled[0]["fov"], "fov_end": settled[-1]["fov"],
        "worst_final_zoom_offset": round(worst_err, 5), "worst_any_offset": round(all_err, 5),
        "page_errors": errors,
    }, indent=2))
    ok = worst_err <= TOLERANCE and not errors
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8080")
    ap.add_argument("--drama", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=240)
    a = ap.parse_args()
    sys.exit(asyncio.run(main(a.url, a.drama, a.timeout)))
