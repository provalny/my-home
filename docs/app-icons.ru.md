# Иконки Life Assistant

Четыре варианта созданы встроенным инструментом imagegen и сохранены в проекте:

| Вариант | PNG-оригинал | Ресурс macOS |
| --- | --- | --- |
| Северное сияние | `web/public/icons/aurora.png` | `macos/Icons/aurora.icns` |
| Тёплый вечер | `web/public/icons/sunset.png` | `macos/Icons/sunset.icns` |
| Орбита | `web/public/icons/orbit.png` | `macos/Icons/orbit.icns` |
| Тихий лес | `web/public/icons/forest.png` | `macos/Icons/forest.icns` |

PNG сохраняют прозрачность. ICNS содержит размеры от 16 до 1024 пикселей и подготовлен системными sips/iconutil без изменения рисунка. Основная иконка пакета — «Северное сияние». В настройках меняется иконка работающего приложения в Dock. Выбор хранится в прежней папке настроек MyHomeInventory и применяется при запуске; это не создаёт новую квартиру. Значок файла в Finder остаётся основным: запись custom-icon/resource fork в пакет нарушает строгую проверку подписи, поэтому приложение не меняет свой пакет.

## Промпты генерации

Общая часть каждого запроса:

> Use case: stylized-concept. Asset type: production macOS application icon for Life Assistant, a personal home and life organizer. Create ONE standalone polished icon, square 1024x1024 composition.

Затем одна из четырёх тем:

- **aurora:** A luminous frosted-glass rounded house symbol with a single tiny warm window, floating above a soft teal-to-blue aurora. Deep midnight navy rounded-square tile. Calm, cozy, premium.
- **sunset:** A sculptural warm peach and terracotta rounded house symbol with a tiny glowing cream window. Plum to burnt-orange sunset rounded-square tile. Warm, cozy, premium.
- **orbit:** A sculptural pearlescent silver house symbol embraced by a smooth lilac orbital loop, a tiny mint window. Deep violet rounded-square tile. Dreamy cosmic, premium.
- **forest:** A sculptural sage-green house symbol with a warm cream glowing window and a subtle leaf-like roof curve. Dark pine-green rounded-square tile. Quiet forest, organic, premium.

Общее окончание каждого запроса:

> Clear bold silhouette readable at 32px. Soft tactile 3D, restrained rich material, gentle studio reflections, no busy scenery. Rounded-square tile occupies central 84% of canvas, with transparent outer corners and transparent margin; no text, letters, labels, watermark, device mockup or surrounding UI. Subtle shadow only beneath the tile. Center emblem fills about 60% of tile. Deliver only the icon.

Каждый вариант сгенерирован отдельным запросом, с `transparent_background: true`. CLI и API-ключ не использовались. Фактические размеры PNG сохранены такими, как вернул инструмент; размеры ICNS подготовлены отдельно. Превью в настройках: `docs/images/app-icons-0.4.1.png`.
