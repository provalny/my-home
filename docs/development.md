# Разработка / Development

## Сборка из исходников

Нужны macOS, Xcode Command Line Tools, Node.js **22.12+** и **pnpm 11**.

Текущая версия — 0.4.31. [Открытие хранилищ и настройка комнат](storage-focus.ru.md).

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
