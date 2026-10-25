# Разработка / Development

## Сборка из исходников

Нужны macOS, Xcode Command Line Tools, Node.js **22.12+** и **pnpm 11**.

Текущая версия — 0.4.70. [Открытие хранилищ и настройка комнат](storage-focus.ru.md).

```sh
git clone https://github.com/provalny/my-home.git
cd my-home
pnpm --dir web install --frozen-lockfile
pnpm --dir web test
bash scripts/build-inventory.sh
```

Результат: `build/Life Assistant.app`. Для обеих архитектур: `INVENTORY_UNIVERSAL=1 bash scripts/build-inventory.sh`. Установщик: `bash scripts/package-inventory.sh`.

Для разработки интерфейса: `pnpm --dir web dev`. В браузере данные сохраняются отдельно от Mac-приложения; системные уведомления, автоматические копии и обновления доступны в приложении. Для изолированной проверки задайте `HOUSE_DATA_DIR` с временной папкой.

[Как выпускаются обновления](docs/releases.md) · [Согласованные возможности](docs/inventory-requirements.ru.md) · [Проверки](docs/validation.ru.md)


## Проверка нативного хранилища

```sh
swiftc macos/Sources/HomeInventory/InventoryStore.swift scripts/test-inventory-store.swift -o /tmp/myhome-store-checks
/tmp/myhome-store-checks
```

All storage checks use isolated temporary directories. Build output and local inventory files must stay out of Git.

## Телефон по домашнему Wi-Fi (0.4.43)

Пользовательская инструкция: [Подключить телефон](phone-access.ru.md).
`InventoryLANServer` запускается только по кнопке в настройках и обслуживает
готовую статическую сборку `WebHost.assetRoot`. Сохранения используют тот же
`InventoryStore` и очередь, что нативный интерфейс. Отдельного писателя файла
и отдельной базы браузера телефона нет. Системные настройки и выбор папки
копирования остаются на Mac. `NSLocalNetworkUsageDescription` включён в
шаблон Info.plist сборки.

Ссылка содержит случайный ключ во фрагменте, который обменивается на
HttpOnly/SameSite=Strict cookie (24 часа), после чего удаляется из адреса.
Перезапуск приложения и обновление QR отзывают все сеансы. API не включает
CORS; проверяет Origin, Host, специальный заголовок, размер запроса и ревизию.
Сервер принимает локальные IP, не публикует Bonjour и не настраивает роутер.
Статические пути проверяются после раскрытия symlink; dotfiles и source maps
не обслуживаются. Это HTTP для доверенной домашней сети, без TLS и облака.

`lan-client.js` не переходит к localStorage или демонстрационной квартире
при ошибке подключения. Браузер опрашивает ревизию каждые три секунды, пока
видим; Mac получает событие после удалённого сохранения. Открытые формы и
редактор не заменяются; конфликт требует обновления с подтверждением.
Внешние изменения очищают локальную историю отмены. Для HTTP UUID создаются
через `getRandomValues`, если `randomUUID` недоступен.

Проверка реального HTTP и QR на временной базе (macOS, разрешение сети):

```sh
swiftc macos/Sources/HomeInventory/InventoryStore.swift \
  macos/Sources/HomeInventory/InventoryLANServer.swift \
  macos/Sources/HomeInventory/ItemMasterHTTP.swift \
  macos/Sources/HomeInventory/ItemMasterTavily.swift \
  scripts/test-inventory-lan.swift -o /tmp/life-lan-checks
/tmp/life-lan-checks
```

Для проверки браузера тестовый исполняемый файл поддерживает
`--serve <путь-к-web/dist> <демонстрационный-JSON>`; JSON должен быть
валидной инвентаризацией. Режим создаёт временную базу, не читает
Application Support пользователя и печатает тестовую ссылку подключения.

### Пространства в общем документе (0.4.33)

Первое пространство использует прежний `plan` и необязательные метаданные
`space: {name,type}`; дополнительные пространства находятся в `spaces`
(`{id,name,type,plan}`). Комнаты дополнительных планов имеют `spaceId`.
Старые комнаты без этого поля принадлежат пространству `home`.
Узлы, категории, события, корзина и настройки общие; виртуальная комната
`room:unplaced` не принадлежит отдельному пространству. ID комнат и мебели
уникальны во всём документе. Текущее пространство — предпочтение интерфейса
`iv:active-space`, а не отдельная база.

`syncPlan` и `clearApartment` принимают необязательный `spaceId`;
по умолчанию обрабатывают исходный план. Перемещение мебели между разными
пространствами переносит связанную геометрию, перенос в «Без места»
отвязывает её. Проверка, миграция, резервная копия и история охватывают
все пространства. Формат документа остаётся версии 1.

### Погодное окружение, стены и Excel (0.4.38)

Погода хранит выбранный город в `settings.weatherLocations[spaceId]`.
Координаты относятся к явно выбранному населённому пункту, геолокации нет.
Open-Meteo Forecast и Geocoding вызываются напрямую по HTTPS; текущие
условия кэшируются на устройстве на 15 минут. При ошибке сохранённые
условия остаются с отметкой в подсказке, без сохранённых данных выводится
«Погода недоступна». Атрибуция Open-Meteo/GeoNames — в выборе города.
Документация: https://open-meteo.com/en/docs и
https://open-meteo.com/en/docs/geocoding-api.

WebGL-просмотр инвентаризации имеет прозрачный фон. Отдельный Canvas2D
рисует погоду под моделью и исключает проектируемый силуэт модели и
видимые полы. У слоя собственный жизненный цикл с остановкой в скрытом
окне и при уничтожении сцены; уменьшение движения оставляет статичный вид.
Только материалы стен получают локальную прозрачность через шейдер.
Геометрия, выбор объектов, расстояния, ограничения зума и цели камеры
не менялись. Нулевой размер ещё не вставленной сцены покрыт регрессией.

`removeMany` предварительно проверяет выбор, обрабатывает родителей
раньше потомков и поддерживает сохранение невыделенного содержимого.
Вся группа коммитится одним `change`, потому отменяется одним действием.

Excel создаётся как OOXML в ZIP без дополнительных зависимостей.
Листы «Вещи» и «Архив» включают общую базу, цены, даты, характеристики,
адреса и флаг наличия фотографии. Встроенные секции и корзина исключены,
фильтры UI игнорируются. Пользовательские строки — inlineStr, без формул.
Браузер скачивает Blob, native-действие `inventoryExportExcel` сохраняет
полученные байты через NSSavePanel и фоновую атомарную запись.


### Редкость предметов (0.4.44)

Обновление 0.4.47: мебель распознаётся по основному предмету в заголовке,
без categoryId/kind. Если мебель названа раньше техники/аксессуаров, текст
после «для/под» отсекается, а в основной части допускаются только прежние
собственные мебельные правила (`furnitureSafe`: IKEA, Herman Miller,
Steelcase, Secretlab и стол с электроподъёмом). Это исключает повышение
«Тумбочка под 3D-принтер» и сохраняет уровень самой техники в названии
«3D-принтер на тумбе». Приоритет типов моделей редактора и ручных уровней
остаётся прежним. DJI также ищется по Диджиай/Ди Джи Ай/Ди-Джи-Ай.
Расширение от 25 октября одобрено командой «давай» и включено в 0.4.48:
121 epic и 37 legendary из отдельного документа. Уточняющие линейки/модели
имеют приоритет над общей маркой. Новые мебельные правила разрешены только
для согласованных производителя/модели (`furnitureSafe`); штативы Gitzo/
Manfrotto — только когда основной предмет штатив (`subject`). Аксессуар
не наследует уровень другого предмета даже при пропуске «для».
Нормализация сохраняет отдельный токен `+`, чтобы Ultimate без плюса не
совпадал с Ultimate+. BenQ SW проверяется как отдельная серия с цифровым
номером, а не произвольный префикс слова (SW271C допустимо, SWARM — нет).

`inventory/rarity-keywords.js` содержит согласованный словарь из
`docs/rarity-keywords-proposal.ru.md`. `titleRarity(name)` учитывает только
заголовок: категория, характеристики и заметки не участвуют. Слова ищутся
целиком, без учёта регистра, с NFKD, нормализацией диакритики/апострофов,
явными русскими псевдонимами и словарём форм. Общие Pro/Premium и т. п.
не создают совпадений. «Первое издание» вместе с «автографом» и Audeze с
LCD-4/LCD-5 проверяются как составные правила в пределах одного заголовка.

Приоритеты: базовые названия, бренды, точные уточняющие фразы/модели,
составные исключения. На равном приоритете выбирается более высокий уровень.
Легендарные бренды защищены от понижения общей фразой вроде «руль Thrustmaster».
Основной аксессуар определяется по словам заголовка; у него исключаются
совпадения с брендом/моделью предназначенной техники, а часть «для/под»
отсекается. Бренды самих сумок/рюкзаков Samsonite/Osprey разрешены в основной
части заголовка. Кэш на 4096 заголовков хранит только итог названия.

`inventory/rarity.js` объединяет ручной уровень, заголовок и прежние исключения
моделей редактора. MacBook, simCockpitTriple, printer3dEnclosed и printer3dOpen
получают минимум epic по `node.modelType` после переименования/снятия с плана;
легендарное совпадение заголовка может повысить их. Без совпадения — common.
Комнаты и встроенные секции исключены. Любой валидный `node.rarity` приоритетен
независимо от названия, включая старые ручные высокие уровни только с брендом
в характеристиках. null/отсутствие означает автоматическое правило.
newNode/updateNode/validate проверяют шесть уровней и применимость к объекту
до изменения документа. Автоматические результаты не записываются массово;
формат документа остаётся version 1.

Карточки, значки, диаграмма и Excel используют один resolver. Форма показывает
живой итог; «Автоматически» сбрасывает ручной уровень, смена категории/полей
не меняет автоматический цвет. Все ручные уровни доступны без слов-ограничений.

### Категории и диаграмма сводки (0.4.41)

`inventory/categories.js` рассчитывает удаление до изменения документа:
только отмеченные ID удаляются, невыбранные потомки переходят к ближайшему
оставшемуся предку или в корень. `categoryId` очищается в активных карточках,
архиве и снимках корзины. Вещи, их поля, история и геометрия сохраняются.
Одна операция входит в общую историю отмены/повтора. В интерфейсе сначала
включается режим галочек, затем показывается подтверждение со списком,
числом назначений и предупреждением о сохранении дочерних категорий.
Переключение списка/плиток сохраняет выделение, после удаления сохраняются
несохранённые названия остальных категорий и новая категория в форме.

В уже прошедшей миграцию базе `modelCategoryId` использует существующие
категории: отсутствующая категория означает выбор пользователя, а сохранение
плана или добавление мебели не должны молча создавать её заново.
Миграция старых документов по-прежнему создаёт исходные системные категории.
Формат данных и версия документа не менялись.

`rarityDistribution` использует общую итоговую редкость и считает активные
карточки item/furniture во всех пространствах, по одной на карточку, как
общий счётчик вещей. Комнаты, секции, контейнеры, архив и корзина исключены.
`rarity-chart.js` строит SVG-кольцо с шестью строками легенды, количеством,
долями, текстовой альтернативой и пустым состоянием. Эпические и легендарные
дуги светятся теми же цветами, что карточки. Нет внешней библиотеки графиков.

Переключение пространств остаётся в боковом меню; под заголовком пространства
сохраняются добавление и настройка, выпадающий список убран. В «Без места»
убраны только верхние переходы: дерево мест слева осталось. Общий значок
этого виртуального места — открытая коробка (unplaced/PackageOpen).
«Настройки» находятся над «Корзиной» со значком gear/Settings.

### Палитры внешнего вида (0.4.42)

`iv:interface.palette` — отдельное устройство-зависимое предпочтение:
ocean (прежнее оформление, default), emerald, amethyst, amber.
Старые настройки без palette и неизвестные значения используют ocean,
сохраняя выбранную тему, материал и положение меню. Изменение применяется
сразу через data-inventory-palette на html, без записи документа, изменения
истории действий или перезапуска 3D/камеры.

`palettes.css` загружается после основных тем. Три новые палитры заменяют
основные токены текста, фона, панелей, акцентов, рамок, бликов и кнопок;
ocean не переопределяется. Светлая/тёмная тема и glass/matte/glow остаются
независимыми. Цветные образцы в настройках имеют подписи и aria-pressed.
Семантические цвета редкости, опасных действий и заполненности сохраняются.
Матовый режим остаётся непрозрачным, настройки уменьшения прозрачности
учтены отдельно. Редактор плана по-прежнему использует собственную палитру.

### Сияние и окружение (0.4.50)

Диаграмма использует встроенный SVG bloom с уникальным ID и светлым краем
реальных epic/legendary дуг. Фильтр не зависит от CSS color-mix/drop-shadow
для SVG в WebKit. Счётчики и доли не изменены; нулевые сектора не создаются.
drawDetails применяет итоговую редкость к самой iv-detail-panel; локальные
цветовые токены и градиенты окрашивают панель от заголовка до истории,
независимо от общей палитры. Обычная карточка сбрасывает эти переопределения.

cozy-exterior.js рисует условный дальний город, деревья, дымку и огоньки
без изображений, геолокации или новых сетевых запросов. Статичный фон
кэшируется в уменьшенном canvas; движущийся свет и погода ограничены 24 fps,
останавливаются в скрытой сцене и при уменьшении движения. Все декорации
и погодные эффекты отсечены живой проекцией квартиры через evenodd clip.
Маска обновляется при изменении камеры, включая reduced motion. Без города
уютное окружение остаётся, день/ночь берётся из темы; с погодой — из её данных.
Параметры камеры, зум и подлёт не менялись.

### Равная высота плиток (0.4.51)

Сетки комнат, хранения, фотографий и категорий используют grid-auto-rows:1fr,
поэтому высота одинакова и между рядами, а не только внутри одного ряда.
Высоту определяет содержимое самой высокой плитки без заданной пустой высоты.
Прокрутка хранения вынесена в iv-storage-scroll: внутренняя сетка получает
естественную высоту, карточки и их основной блок не сжимаются по высоте
панели. На узком экране wrapper не ограничивает обычную прокрутку страницы.
В компактном каталоге кнопки выровнены к низу плиток. Данные не менялись.

## Аудит интерфейса и настройки (0.4.54/build60)

`drawSettings` сохраняет активную вкладку при перерисовке. Переключение
вкладок скрывает уже созданные панели, поэтому введённый интервал не теряется;
его черновик также сохраняется при обновлении состояния. Диапазон 0–365,
целое обязательное значение; сохранение через валидируемую форму.
Оформление и компактное меню — предпочтения устройства. Анимации и сроки —
настройки общей базы. Системные действия остаются только в native-ветке;
LAN показывает общую базу и доступные экспорты без восстановления.

`interface-polish.css` завершает каскад интерфейса: настройки, переносы
истории и bulk-действий, фокус, компактная мобильная шапка и область нажатия.
В узком настольном/browser-редакторе панели временно перекрывают план,
не перезаписывая сохранённые ширины и свёрнутость широкого режима.
При переходе через 700 px предпросмотр пересоздаётся, если меняется
видимость правой панели. iOS-ветка и жесты камеры не изменялись.


## Мониторинг квартиры (0.4.56/build62)

`web/src/monitoring/model.js` — независимая ветка `monitoring` документа
версии 1. Каждая квартира содержит свои услуги, счётчики, показания, ручной
расход, тарифы, счета, оплаты, климат, задачи, месячные правила и отметки
выполнения. `planSpaceId` — единственная связь с планом; сцена получает его
копию и не открывает вещи. Нет внешних API и управления устройствами.
Старые документы не изменяются до явного добавления квартиры мониторинга.
Валидация, сохранение с проверкой ревизии, полная копия и undo/redo общие.

Деньги — целые копейки. Показания не порождают расход; тарифы не порождают
счета. Суммируются только внесённые записи. Платежи считаются по дате оплаты,
начисления — по месяцу счёта, остаток — на конец выбранного месяца.
Неизвестные расходы показаны прочерком, разные единицы не складываются.
Работы с ценой имеют свой журнал; включение в начисления требует счёта.
Вложения ограничены JPG/PNG/WebP/PDF, до 8 файлов по 2 МБ на счёт.

`MonitoringReminders.swift` генерирует расписание без системных действий.
`InventoryApp` добавляет его в существующее планирование уведомлений:
общий переключатель плюс настройки квартиры, без повторов доставленных
напоминаний; нажатие открывает обслуживание нужной квартиры. Проверки
расписания не запрашивают разрешения и не отправляют уведомления.

Проверки:

```sh
pnpm --dir web test
pnpm --dir web build
swiftc -module-cache-path /tmp/monitoring-swift-cache \
  macos/Sources/HomeInventory/MonitoringReminders.swift \
  scripts/test-monitoring-reminders.swift -o /tmp/monitoring-reminder-checks
/tmp/monitoring-reminder-checks
```

Для UI: `scripts/check-monitoring-ui.cjs` использует отдельный временный
профиль браузера. Нужен доступный Playwright (или `PLAYWRIGHT_MODULE`),
установленный Chrome (или `CHROME_BIN`) и сервер `MONITORING_URL`
(по умолчанию `http://127.0.0.1:5208`). Проверка не читает Application Support.
Прямая ссылка `?section=monitoring` открывает новый раздел без мастера категорий.

### Travel browser module

`web/src/travel` owns trip references, day events, routes, bag capacities and
loadouts. Inventory remains the owner of physical item records and weights
(`fields['Вес, г']`); transfers never change storage parent IDs. Validation is
part of the shared inventory validator. Deleted/archived source items are
reported in bag totals and skipped on loadout application. Completed trips
release active membership labels. Shared undo/persistence covers trip changes.

Leaflet uses OSM tiles for normal online viewing. Photon search is submit-only;
FOSSGIS OSRM handles car/foot/bike, manual/train/plane segments use explicitly
labelled straight geometry. Requests are sequential and rate-limited. Providers
can be configured in the route window. Downloaded Overpass vectors live in
IndexedDB, limited to 25,000 km² / 30 MB per visible region, one region per trip.
They are device-local and are not part of inventory JSON backups. Public raster
map tiles are not bulk-cached. `offline-plugin.js` emits the production service
worker for same-origin build assets only; it never caches API responses or LAN
inventory endpoints. Fresh deployment activates on the next clean visit after
old tabs close. Development mode does not register a worker.

Demo URL: `?section=travel&demo=travel`; separate browser key
`my-home-inventory:v1:travel-demo-v1`. UI regression: `scripts/check-travel-ui.cjs`
with optional `TRAVEL_URL`, using isolated Chrome context and mocked external
services. Production preview is recommended when other chats edit the same tree.

### Trip storage revision (0.4.64)

The existing `travel.trips[].bags` array now stores `kind: bag | box | car`;
missing kind means legacy bag. Car entries reference the vehicle root node and
exclude vehicle mass from cargo totals. Legacy `carId` migrates once to a stable
storage ID and is cleared. Loadouts use the same schema; source parent IDs never
change. Unknown car/container capacity is nullable. Per-item volume is optional
`fields['Объём, л']`, distinct from manually occupied storage liters.

`inventory/weights.js` supplies editable, explicitly marked planning estimates
for furniture with no entered weight. Existing values win. `weightEstimate`
records provenance and the estimated grams; a manual correction clears it.
This is not a manufacturer specification catalog. A weight/volume editor in
item details makes corrections available without changing trip membership.
UI regression: `scripts/check-travel-storage-ui.cjs` plus the updated
`check-travel-ui.cjs`, isolated browser profiles only.


### Inventory and travel remarks (0.4.75/build81)

Furniture `storageEnabled: false` is centralized through `canStore`: it preserves
object identity, plan geometry and purchase value while excluding it from storage
counts, trees and destinations. Occupied furniture cannot be disabled; empty
structural sections use recoverable removal and shared undo. Migration does not
recreate them. Travel candidates respect the role while permitting ordinary bags.

Rental charges split an entered integer-cent amount across active services, excluding
security, mobile and internet. Remainders preserve the exact total. It creates normal
bills in the selected month without calculating consumption or marking payments.

Trip checkboxes and pointer dragging transfer only trip references. The shared
storage drag helper keeps its inventory defaults and accepts trip selectors.
Storage search requires a selected result or explicit creation; car creation registers
the global vehicle and trip reference in one undoable change. Time uses separate
24-hour and minute controls. Overview previews render cached vehicle geometry.

Validation: 327 unit tests; production web build; CUA checks on isolated travel-demo
origin (creation, existing car, checkboxes, bulk pointer drag, time persistence, rental,
storage role and search). No writes to personal/native data. Existing standalone UI
scripts have updated locators but were not run for this batch.
Responsive checks at 390×844 confirmed no page overflow and fully visible event
and rental forms. Desktop car headings wrap within their cards; both vehicle previews
render. Console error log was empty. Proof screenshots are in `docs/images/remarks-*`.
