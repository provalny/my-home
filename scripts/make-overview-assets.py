#!/usr/bin/env python3
"""Generate code-native, self-contained SVG artwork for the GitHub overview."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "overview"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
ICONS = {
    "home": '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    "box": '<path d="m12 3 9 5v9l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v9 M7 5.8l9 5"/>',
    "meter": '<path d="M4 18a10 10 0 1 1 16 0 M12 12l5-5 M5 5l1.5 1.5 M3 12h2 M19 12h2 M7 20h10"/><circle cx="12" cy="12" r="2"/>',
    "car": '<path d="m4 10 2-6h12l2 6 M3 10h18v9H3Z M6 19v2 M18 19v2 M7 14h.01 M17 14h.01"/>',
    "route": '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/>',
    "heart": '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
}

def icon(name, x, y, size, color):
    return f'<g transform="translate({x} {y}) scale({size/24})" fill="none" stroke="{color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>'

def svg(width, height, title, content):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title">
<title id="title">{escape(title)}</title>
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0b1627"/><stop offset=".55" stop-color="#152840"/><stop offset="1" stop-color="#272334"/></linearGradient><linearGradient id="edge"><stop stop-color="#66c8ff"/><stop offset=".55" stop-color="#aa9aff"/><stop offset="1" stop-color="#efbd81"/></linearGradient><radialGradient id="glow"><stop stop-color="#5b9ddd" stop-opacity=".18"/><stop offset="1" stop-color="#5b9ddd" stop-opacity="0"/></radialGradient></defs>
<g font-family="{FONT}">{content}</g></svg>'''

features = [
    ("space", "home", "#8bcaff", "01", "Пространство в 3D", "Каждой вещи — своё место.", "3D spaces", "Give every item a place."),
    ("catalog", "box", "#c0a5ff", "02", "Каталог без пропусков", "Фото, стоимость и точный адрес.", "Your complete inventory", "Photos, value and a precise location."),
    ("monitoring", "meter", "#f2c27e", "03", "Дом под наблюдением", "Показания, счета и обслуживание.", "Keep track of your home", "Readings, bills and maintenance."),
    ("automobile", "car", "#7ccecf", "04", "Всё об автомобиле", "Поездки, расходы, ТО и хранение.", "Everything about your car", "Trips, costs, maintenance and storage."),
    ("travel", "route", "#a1d8b7", "05", "Собирайтесь в путь", "Маршрут, дни, сумки и лодауты.", "Ready for your next trip", "Routes, daily plans, bags and loadouts."),
    ("metrics", "heart", "#eda8bd", "06", "Внимание к себе", "Самочувствие, сон и активность.", "Make time for yourself", "Well-being, sleep and activity."),
]
for key, name, color, number, ru, ru_desc, en, en_desc in features:
    for lang, title, desc in [("ru", ru, ru_desc), ("en", en, en_desc)]:
        body = f'''<rect x="1" y="1" width="638" height="162" rx="22" fill="url(#bg)" stroke="#35455d"/>
<circle cx="585" cy="20" r="115" fill="url(#glow)"/>
<rect x="25" y="35" width="66" height="66" rx="19" fill="{color}" fill-opacity=".10" stroke="{color}" stroke-opacity=".25"/>
{icon(name, 42, 52, 32, color)}
<text x="112" y="40" font-size="11" fill="{color}" letter-spacing="2.4">LIFE ASSISTANT / {number}</text>
<text x="112" y="80" font-size="27" font-weight="650" fill="#f0f5ff">{escape(title)}</text>
<text x="112" y="109" font-size="17" fill="#b5c3d6">{escape(desc)}</text>
<path d="M26 138H614" stroke="url(#edge)" stroke-opacity=".55"/>
<circle cx="605" cy="39" r="3" fill="{color}"/>'''
        (OUT / f"{key}-{lang}.svg").write_text(svg(640, 164, f"{title}. {desc}", body))

for lang in ["ru", "en"]:
    heading = "Меньше искать. Больше жить." if lang == "ru" else "Less searching. More living."
    sub = "Дом, вещи, автомобиль, поездки и привычки." if lang == "ru" else "Home, belongings, cars, journeys and daily life."
    local = "Данные на вашем Mac" if lang == "ru" else "Your data stays on your Mac"
    body = f'''<rect x="1" y="1" width="1278" height="438" rx="30" fill="url(#bg)" stroke="#34455c"/>
<circle cx="1050" cy="180" r="310" fill="url(#glow)"/>
<path d="M720 1v438 M720 220h559" stroke="#8abde9" stroke-opacity=".06"/>
<rect x="48" y="42" width="42" height="42" rx="13" fill="#9acbff" fill-opacity=".12" stroke="#8cbfff" stroke-opacity=".3"/>
{icon('home', 57, 51, 24, '#a6d1ff')}
<text x="105" y="70" font-size="15" font-weight="600" letter-spacing="3" fill="#a9c7e7">YOUR EVERYDAY, ORGANIZED</text>
<text x="48" y="157" font-size="67" font-weight="700" letter-spacing="-2.5" fill="#f0f5ff">Life Assistant</text>
<text x="48" y="225" font-size="34" font-weight="500" letter-spacing="-.7" fill="#e3eaf5">{heading}</text>
<text x="48" y="266" font-size="22" fill="#aebfd4">{sub}</text>
<rect x="48" y="322" width="590" height="58" rx="17" fill="#bcd8ff" fill-opacity=".05" stroke="#829bbf" stroke-opacity=".23"/>
<text x="69" y="357" font-size="16" fill="#cdddf0">macOS 13+ <tspan fill="#627b99"> / </tspan> Apple silicon + Intel <tspan fill="#627b99"> / </tspan> MIT</text>
<circle cx="969" cy="222" r="131" fill="none" stroke="#7a9dc4" stroke-opacity=".21"/>
<circle cx="969" cy="222" r="75" fill="none" stroke="#7a9dc4" stroke-opacity=".17" stroke-dasharray="3 9"/>
<path d="M969 85v274 M834 222h270" stroke="url(#edge)" stroke-opacity=".3"/>
<rect x="915" y="168" width="108" height="108" rx="30" fill="#14253b" stroke="#93b8e6" stroke-opacity=".5"/>
{icon('home', 943, 196, 52, '#d2e4ff')}
<circle cx="969" cy="91" r="34" fill="#162a42" stroke="#8bcaff" stroke-opacity=".6"/>{icon('box', 955, 77, 28, '#8bcaff')}
<circle cx="1100" cy="222" r="34" fill="#202b3d" stroke="#f2c27e" stroke-opacity=".6"/>{icon('car', 1086, 208, 28, '#f2c27e')}
<circle cx="969" cy="353" r="34" fill="#182e32" stroke="#a1d8b7" stroke-opacity=".6"/>{icon('route', 955, 339, 28, '#a1d8b7')}
<circle cx="838" cy="222" r="34" fill="#2b263a" stroke="#eda8bd" stroke-opacity=".6"/>{icon('heart', 824, 208, 28, '#eda8bd')}
<text x="969" y="420" text-anchor="middle" font-size="15" fill="#aebfd4">{local}</text>
<path d="M49 405H638" stroke="url(#edge)" stroke-opacity=".6"/>'''
    (OUT / f"hero-{lang}.svg").write_text(svg(1280, 440, f"Life Assistant. {heading} {sub}", body))
print(f"Generated 14 SVG assets in {OUT}")
