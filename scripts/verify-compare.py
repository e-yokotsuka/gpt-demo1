# compare.html 経由（iframe 遅延ロード）でデモを開き、エラー収集とスクショ撮影を行う検証スクリプト
# 使い方: python scripts/verify-compare.py <tab> <出力先ディレクトリ> [デモID...]
#   例:   python scripts/verify-compare.py fable52 C:/tmp/shots matrix snow
import sys, glob, os, json
from playwright.sync_api import sync_playwright

tab = sys.argv[1]
out = sys.argv[2]
targets = sys.argv[3:]
os.makedirs(out, exist_ok=True)

# デモID無指定なら、そのタブのディレクトリにある全HTMLを対象にする
if not targets:
    targets = sorted(os.path.basename(f)[:-5] for f in glob.glob(tab + "/*.html"))

compare = "file:///" + os.path.abspath("compare.html").replace("\\", "/")
report = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for name in targets:
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errs = []
        page.on("pageerror", lambda e, errs=errs: errs.append("PAGEERROR: " + str(e)))
        def onconsole(m, errs=errs):
            if m.type == "error":
                errs.append("CONSOLE.error: " + m.text)
        page.on("console", onconsole)
        try:
            # まず既定タブで開き、その後に対象タブをクリックする（実際の閲覧手順を再現）
            page.goto(compare + "?demo=" + name, wait_until="load", timeout=30000)
            page.wait_for_timeout(500)
            page.click("#tab-" + tab)
        except Exception as e:
            report.append({"name": name, "err": ["OPEN: " + str(e)]})
            page.close()
            continue
        page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(out, name + "-1.png"))
        # 操作を試みる（中央クリック＋Enter＋Space＋矢印キー）
        try:
            page.mouse.click(640, 450)
            page.keyboard.press("Enter")
            page.wait_for_timeout(150)
            page.keyboard.press("Space")
            page.keyboard.press("ArrowRight")
            page.mouse.move(700, 500)
        except Exception:
            pass
        page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(out, name + "-2.png"))
        # iframe 内の canvas サイズも記録（0×0 検出用）
        info = None
        try:
            frame = page.frame_locator("#" + tab + "-frame")
            info = frame.locator("canvas").first.evaluate("c => c.width + 'x' + c.height", timeout=1000)
        except Exception:
            info = "no-canvas"
        report.append({"name": name, "canvas": info, "err": errs})
        page.close()
    browser.close()

print("SHOTS_DIR:", out)
print(json.dumps(report, ensure_ascii=False, indent=1))
