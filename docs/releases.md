# Выпуск обновлений / Release maintenance

Публичный проект: [provalny/my-home](https://github.com/provalny/my-home). Версии интерфейса, Mac-приложения, установщика и канала обновлений используют `web/src/inventory/releases.json`.

## Обычный выпуск

1. Добавьте новую запись первой в `releases.json`: новая версия, увеличенный `build`, дата, краткое описание изменений для пользователя. Старые записи сохраняйте.
2. Пройдите проверки: `pnpm --dir web test` и `node scripts/check-release.mjs`. Сохраните и отправьте изменения в `main`.
3. Создайте тег с соответствующей версией, например `git tag v0.3.1`, затем `git push origin v0.3.1`.
4. Workflow **Release My Home** проверит соответствие тега, выполнит тесты, соберёт универсальное приложение (arm64 + x86_64), DMG и ZIP, подпишет архив обновления и опубликует релиз с `appcast.xml`.
5. Убедитесь, что workflow прошёл и файлы доступны в релизе. До завершения workflow прежний релиз остаётся текущим. Не переиспользуйте уже опубликованные версии и номера сборки.

Ручной запуск workflow из Actions делает проверочную сборку и сохраняет артефакты, без публикации релиза. Workflow **Checks** запускает тесты и сборку интерфейса при изменениях и pull request. Исходники, опубликованные в `main`, становятся обновлением для пользователей только после выпуска нового тега и успешной сборки.

## Подпись и доставка

- `distribution.json` содержит имя GitHub-репозитория и **публичный** ключ Ed25519. В приложение записываются `SUPublicEDKey` и HTTPS-адрес `…/releases/latest/download/appcast.xml`.
- Отдельный закрытый ключ этого приложения хранится в Связке ключей разработчика (аккаунт `my-home-inventory`) и в зашифрованном GitHub Actions secret **SPARKLE_EDDSA_PRIVATE_KEY** этого репозитория. Его нельзя добавлять в Git, документацию, логи или файлы релиза.
- Подпись ставит официальный `generate_appcast` из закреплённой зависимости Sparkle. Пользовательский Mac проверяет подпись при обновлении.
- В настройках приложения можно отключить автоматическую проверку; ручная команда есть в настройках и меню приложения. Установка происходит после подтверждения пользователя. Системный профиль Sparkle выключен.
- Не меняйте `local.myhome.inventory` или папку `MyHomeInventory` при обычном обновлении: это сохраняет доступ к квартире и настройкам. Обновления не должны включать реальные пользовательские базы.
- Текущая сборка имеет локальную подпись ad hoc, без Developer ID и нотарификации Apple. Подпись архива Sparkle подтверждает происхождение обновления, но не заменяет нотарификацию Apple для первого скачивания. Включение Developer ID и нотарификации требует отдельной настройки сертификатов Apple.

При потере закрытого ключа не выпускайте обновление со случайным новым ключом поверх существующего канала: уже установленные приложения должны доверять подписи. Оставьте ключ в Связке ключей и секрет GitHub в сохранности. [Документация Sparkle](https://sparkle-project.org/documentation/).

## Данные и совместимость

Версия приложения и версия документа инвентаризации независимы. Совместимые дополнительные поля не требуют сброса квартиры. Перед первым сохранением мигрированного документа и перед восстановлением создаётся защитная копия.

Награды имеют постоянные ID, вычисляют прогресс из данных, отдельно хранят факт получения и входят в JSON-копии. Новые награды проверяются при запуске/изменениях, импорте и восстановлении. Ранее подтверждённые награды не исчезают при удалении вещи. Ошибка необязательного расчёта не блокирует сохранение имущества.

Новые демонстрационные карточки отмечены и не дают наград за личные вещи. Старые документы без такой отметки считаются существующим пользовательским учётом: приложение не пытается угадать происхождение внесённых вещей по их именам. При восстановлении старых достижений дата получения остаётся неизвестной.

## English

Update `web/src/inventory/releases.json`, increment the build number, run the checks and push the matching `vX.Y.Z` tag. **Release My Home** builds universal Mac binaries, runs tests, packages the app, signs the update archive using the repository secret and publishes a GitHub release. **Checks** validates pushes and pull requests. A manual release-workflow run only uploads build artifacts.

Keep `distribution.json` public; keep **SPARKLE_EDDSA_PRIVATE_KEY** secret. The app reads its HTTPS Sparkle feed from the latest release and verifies Ed25519 signatures before installing an update. Do not change the bundle identifier or inventory data folder between ordinary releases. Source pushes alone are not installed on users’ machines.

Current downloads use ad-hoc code signing without Apple notarization. Sparkle archive signing and Apple Developer ID/notarization serve different purposes; adding the latter requires Apple credentials. Never commit these credentials or actual inventory files.
