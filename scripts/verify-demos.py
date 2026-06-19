# claude48 デモを実ブラウザで開き、エラー収集とスクショ撮影を行う検証スクリプト
import sys, glob, os, json
from playwright.sync_api import sync_playwright

OUT = "C:/Users/yokot/AppData/Local/Temp/claude/shots"
os.makedirs(OUT, exist_ok=True)

# 引数でデモ名を絞り込み可能（無指定なら全件）
targets = sys.argv[1:]
files = sorted(glob.glob("claude48/*.html"))
if targets:
    files = [f for f in files if os.path.basename(f)[:-5] in targets]

report = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for f in files:
        name = os.path.basename(f)[:-5]
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errs = []
        page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        def onconsole(m):
            if m.type == "error":
                errs.append("CONSOLE.error: " + m.text)
        page.on("console", onconsole)
        url = "file:///" + os.path.abspath(f).replace("\\", "/")
        try:
            page.goto(url, wait_until="load", timeout=20000)
        except Exception as e:
            report.append({"name": name, "err": ["GOTO: " + str(e)]})
            page.close()
            continue
        page.wait_for_timeout(1000)
        # ゲーム開始を試みる（中央クリック＋Enter＋Space）
        try:
            page.mouse.click(640, 400)
            page.keyboard.press("Enter")
            page.wait_for_timeout(150)
            page.keyboard.press("Space")
        except Exception:
            pass
        page.wait_for_timeout(2600)
        try:
            page.screenshot(path=os.path.join(OUT, name + ".png"))
        except Exception as e:
            errs.append("SHOT: " + str(e))
        report.append({"name": name, "err": errs})
        page.close()
    browser.close()

print("SHOTS_DIR:", OUT)
print(json.dumps(report, ensure_ascii=False, indent=1))
