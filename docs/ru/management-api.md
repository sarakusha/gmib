# REST API для автоматизации GMIB

Новые маршруты управления, включая `/api/manage/v1/hosts`, поддерживаются начиная с GMIB **5.6.0**.
На целевом устройстве эта версия должна быть опубликована и установлена. Ответ HTTP 404 от нового
маршрута на предыдущей версии не означает ошибку пароля или пустой список устройств.

Этот документ описывает существующий REST API GMIB и standalone helper для скриптов и Ansible.
Полный второй CRUD в `/api/manage/v1` не создается: экраны, плееры, плейлисты, привязки и оба
планировщика уже доступны через маршруты `/api/*`. Namespace `/api/manage/v1` используется только
для недостающих административных операций: смены общего пароля, lifecycle плагинов и разрешенных
параметров яркости.

## Адрес и защита

HTTP API слушает порт `NIBUS_PORT + 1`, по умолчанию `9002`. В helper передается origin без `/api`,
например `http://gmib-sign-01:9002`. Сетевой клиент выполняет SRP login, проверяет доказательство
`M2`, затем подписывает каждый запрос HMAC-SHA256. В подпись входят метод, фактический path вместе с
query, timestamp и непустое JSON-тело. Допустимое расхождение часов обычно составляет пять минут.

SRP и HMAC не шифруют HTTP-трафик. Для недоверенной сети нужен VPN или TLS-прокси. Схема протокола,
формат ошибок и смена пароля подробно описаны в [rest-api-auth.md](rest-api-auth.md). Строгая
авторизация сохраняется при `unsafeMode` для management routes и plugin routes с
`access: "authenticated"`.

## Карта существующих маршрутов

Все перечисленные маршруты доступны в текущем API. Ответы и тела — JSON, если в таблице не указано
иное. Мутации обычных ресурсов требуют действующей лицензии; чтение разрешено до активации, но
по-прежнему требует авторизации. Пустой успешный ответ может иметь статус `200` или `204` в
зависимости от маршрута.

| Область                   | Маршруты                                                                                                                                                   | Тело и результат                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Идентификация             | `GET /api/identifier`                                                                                                                                      | Строковый identifier сервера; маршрут свободен от авторизации.                                                                                                                                   |
| Состояние и лицензия      | `GET /api/announce`                                                                                                                                        | Состояние лицензии, версия, платформа, `autostart`, `exactWindowPlacement`. Не используйте поля legacy `announce`/`iv` как новый контракт.                                                       |
| Активация                 | `POST /api/activate`                                                                                                                                       | `{key, name?}`; успешный запрос инициирует перезапуск. Ключ передавайте через защищенный JSON input helper, не через argv.                                                                       |
| Повтор лицензии           | `POST /api/license/retry`                                                                                                                                  | Без тела; `409`, если действующая лицензия не получена.                                                                                                                                          |
| Экраны                    | `GET /api/screen`, `GET /api/screen/:id`, `POST /api/screen`, `PUT /api/screen`, `DELETE /api/screen/:id`                                                  | `Screen`; create принимает как минимум `{name}`, update — объект с `id`. Ответы create/update возвращают фактический объект.                                                                     |
| Перезагрузка вывода       | `PUT /api/screen/:id/reload`                                                                                                                               | Перезагружает уже открытое окно экрана, `404`, если его нет.                                                                                                                                     |
| Дисплеи                   | `GET /api/display`                                                                                                                                         | Массив Electron display descriptors; значения зависят от текущей ОС и сессии.                                                                                                                    |
| Плееры                    | `GET /api/player`, `GET /api/player/:id`, `POST /api/player`, `PUT /api/player`, `DELETE /api/player/:id`                                                  | `Player`; update требует числовой `id`, create/update возвращают фактический объект.                                                                                                             |
| Управление выводом плеера | `PUT /api/player/:id/stop`, `PUT /api/player/:id/output`, `DELETE /api/player/:id/output`                                                                  | Для visibility: `{visible:boolean}`. Это runtime action, а не сохранение desired state.                                                                                                          |
| Плейлисты                 | `GET /api/playlist`, `GET /api/playlist/:id`, `POST /api/playlist`, `PUT /api/playlist`, `DELETE /api/playlist/:id`                                        | `CreatePlaylist`/`Playlist`, включая `items`.                                                                                                                                                    |
| Элементы плейлиста        | `PATCH /api/playlist/:id`                                                                                                                                  | Либо `{insert:[mediaMd5,...]}`, либо `{remove:itemId}`; возвращает плейлист целиком.                                                                                                             |
| Медиатека                 | `GET /api/media`, `GET /api/media/:md5`, `POST /api/media`, `DELETE /api/media/:md5`                                                                       | Upload — multipart, остальные ответы используют `MediaInfo`. Generic JSON helper пока не загружает multipart-файлы.                                                                              |
| Привязки                  | `GET /api/mapping`, `POST /api/mapping`, `PUT /api/mapping`, `DELETE /api/mapping/:id`                                                                     | `PlayerMapping`; create/update возвращают фактическую привязку.                                                                                                                                  |
| Планировщик плеера        | `GET /api/scheduler?playerId=`, `POST /api/scheduler`, `PUT /api/scheduler/:id`, `POST /api/scheduler/:id/run`, `DELETE /api/scheduler/:id`                | `PlayerSchedulerJobInput`/`PlayerSchedulerJob`. Query входит в HMAC.                                                                                                                             |
| Планировщик GMIB          | `GET /api/gmib-scheduler`, `POST /api/gmib-scheduler`, `PUT /api/gmib-scheduler/:id`, `POST /api/gmib-scheduler/:id/run`, `DELETE /api/gmib-scheduler/:id` | `GmibSchedulerJobInput`/`GmibSchedulerJob`. Actions включают тест, яркость и автояркость.                                                                                                        |
| Яркость NovaStar          | `PUT /api/novastar/screens/brightness`                                                                                                                     | `{path, screen?:number, value, persist?:boolean}`; runtime доступен только с соответствующей license capability. Сохранение в контроллер не является read-back проверкой.                        |
| Системные параметры       | `POST /api/autostart`, `POST /api/exactWindowPlacement`                                                                                                    | `{value:boolean}`; `exactWindowPlacement` инициирует перезапуск.                                                                                                                                 |
| Перезапуск                | `POST /api/relaunch`                                                                                                                                       | Action без тела.                                                                                                                                                                                 |
| Страницы вывода           | `GET /api/pages`, `POST /api/pages`, `PUT /api/pages/:id`, `DELETE /api/pages/:id`                                                                         | `Page`; update берет `id` из path.                                                                                                                                                               |
| Параметры яркости         | `GET /api/manage/v1/settings`, `PATCH /api/manage/v1/settings?dryRun=true`                                                                                 | Allowlist параметров яркости, автояркости, локации и кривых; без `dryRun` или при `false` изменения сохраняются. Подробный контракт приведен в [management-settings.md](management-settings.md). |
| Удаленные хосты           | `GET /api/manage/v1/hosts`, `PUT /api/manage/v1/hosts?dryRun=true`                                                                                         | Saved endpoints и текущий passive mDNS snapshot раздельно; PUT атомарно заменяет полный saved list с optimistic revision.                                                                        |
| Plugin runtime            | `/api/plugins/:pluginId/*`                                                                                                                                 | Маршруты и DTO объявляет сам plugin с `access: "authenticated"`; они требуют auth и не открывают local routes. Единой формы `/settings` для всех plugins нет.                                    |
| Plugin lifecycle          | `/api/manage/v1/plugins/*`                                                                                                                                 | Установка, inspect, включение и удаление без GUI. Контракт и ограничения описаны ниже; требуется лицензия Plus или выше.                                                                         |
| Смена пароля              | `PUT /api/manage/v1/auth/password`                                                                                                                         | `{salt, verifier}`; helper принимает новый пароль локально и вычисляет эти параметры сам. Маршрут доступен до активации лицензии.                                                                |

`POST /api/screen` не поддерживает запись `brightness`, а `addresses` при создании не сохраняется.
Идемпотентный resource helper исключает эти поля из POST и, если они заданы, применяет их следующим
`PUT` с фактическим server-generated `id`.

Основные DTO находятся в [`packages/common/video.ts`](../../packages/common/video.ts),
[`packages/common/playlist.ts`](../../packages/common/playlist.ts),
[`packages/common/scheduler.ts`](../../packages/common/scheduler.ts) и
[`packages/common/mediaInfo.ts`](../../packages/common/mediaInfo.ts). Серверные обработчики являются
окончательным источником поведения: [`packages/main/src/api.ts`](../../packages/main/src/api.ts) и
[`packages/main/src/novastarApi.ts`](../../packages/main/src/novastarApi.ts).

Машиночитаемая схема статических маршрутов находится в
[`docs/api/openapi.json`](../api/openapi.json); пояснения и границы схемы — в
[`docs/api/README.md`](../api/README.md). Готовый минимальный сценарий Ansible описан в
[management-ansible.md](management-ansible.md).

## Удаленные хосты и inventory

`GET /api/manage/v1/hosts` возвращает `{revision, saved, discovered}`. `saved` — пользовательский
список из существующей настройки GMIB, а `discovered` — текущий снимок уже работающего passive mDNS
discovery. Чтение не выполняет сетевые probes и не переносит найденные endpoints в saved list. Оба
маршрута требуют авторизацию даже при `unsafeMode`; PUT также требует действующую лицензию. Ответы
помечены `Cache-Control: no-store`. Снимок discovery отражает внутренний кэш mDNS, а не
гарантированную доступность хоста в момент ответа.

Каждый endpoint содержит `key`, `address`, `nibusPort`, `apiPort` и необязательное `name`.
`nibusPort` — сохраненный порт сервиса NiBUS, а HTTP API GMIB использует следующий порт, поэтому
`apiPort = nibusPort + 1` и допустимый `nibusPort` ограничен диапазоном 1–65534. `key` строится из
нормализованных address и NiBUS port; IPv6 в key заключен в квадратные скобки. Это идентичность
сетевого endpoint, а не стабильный device ID. Для обнаруженного endpoint могут дополнительно
возвращаться `version`, `platform`, `arch` и `osVersion`; credentials, license fields и machine ID в
DTO отсутствуют.

Management API различает endpoints с одинаковым address и разными NiBUS ports. Существующее меню
удаленных хостов GMIB может сгруппировать их по address; этот API не меняет поведение меню.

PUT принимает только полный desired list и revision из последнего GET:

```json
{
  "revision": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "hosts": [
    { "address": "gmib-sign-01.example", "nibusPort": 9001, "name": "Главный экран" },
    { "address": "2001:db8::10", "nibusPort": 9101 }
  ]
}
```

Revision вычисляется только по нормализованному saved list: появление или исчезновение mDNS-хоста не
создает ложный конфликт. Если saved list изменился после GET, PUT возвращает `412` и текущую
revision; клиенту нужно перечитать список и заново выполнить merge. `dryRun=true` полностью
проверяет адреса, порты, дубликаты и revision, но не сохраняет данные. Возвращенная при dry-run
revision описывает predicted list и станет текущей только после обычного PUT на той же base
revision. Повтор идентичного списка возвращает `changed:false` и не перезаписывает настройку.

PUT нормализует hostname через IDNA и lowercase, удаляет завершающую точку DNS и канонизирует IPv6.
URL, пробелы, scoped IPv6, сокращенные или encoded IPv4 формы отклоняются; одинаковые address+NiBUS
port после нормализации считаются дубликатами. Если старый saved list содержит невалидную запись,
GET отвечает `invalid_saved_hosts` с индексом поля и не скрывает запись: сначала исправьте ее в
GMIB, затем повторите синхронизацию.

## Параметры яркости и автояркости

`GET /api/manage/v1/settings` возвращает только `brightness`, `autobrightness`, `location`,
`spline`, `sunSpline` и `nightMode`. `PATCH` частично меняет эти поля; повтор тех же значений
возвращает `changed:false`, а `dryRun=true` выполняет validation и read-back без записи. Оба
маршрута требуют авторизацию даже при `unsafeMode`; изменение требует действующей лицензии. Полный
формат, диапазоны, reset-to-default и пример ответа описаны в
[management-settings.md](management-settings.md).

Endpoint сохраняет desired configuration. Фактическое применение автояркости остается в текущем
renderer/runtime и зависит от датчика, локации и жизненного цикла GMIB; read-back конфигурации не
является проверкой яркости на устройстве.

## Настройки плагинов

Authenticated plugin routes под `/api/plugins/:pluginId/*` теперь всегда требуют авторизацию,
включая `unsafeMode`. Они не открывают наружу маршруты с `access: "local"` и не обходят `localOnly`.
Поддержка удаленных настроек, их путь и JSON shape объявляются каждым плагином отдельно;
универсального `/settings` в host API нет. Например, Shader Screensavers предоставляет
`GET/PATCH /api/plugins/shader-screensavers/settings`, а его `/state` остается локальным.

Версия схемы настроек развивается вместе с plugin и не требует выпуска новой версии host API. Плагин
может предоставить собственный authenticated `/openapi.json`. Динамические plugin routes намеренно
не входят в основной [`docs/api/openapi.json`](../api/openapi.json): host отвечает только за auth,
license gate и dispatch явно объявленных plugin routes.

## Lifecycle плагинов

Все маршруты ниже требуют авторизацию даже при включенном `unsafeMode` и capability `plugins`
действующей лицензии. Они не пересекаются с runtime-маршрутами `/api/plugins/:pluginId/*`.

| Метод и путь                                                                                                          | Результат                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /api/manage/v1/plugins`                                                                                          | `{plugins: PluginStatus[]}`.                                                                 |
| `GET /api/manage/v1/plugins/catalog`                                                                                  | `{plugins: PluginCatalogEntry[]}` из текущего официального каталога.                         |
| `GET /api/manage/v1/plugins/official/:id/inspect?version=<version>&sha256=<sha256>`                                   | Manifest, SHA-256, размер и текущее состояние без установки.                                 |
| `POST /api/manage/v1/plugins/official/:id/install`                                                                    | Установка или обновление текущего закрепленного release; тело описано ниже.                  |
| `POST /api/manage/v1/plugins/archive/inspect?sha256=<sha256>`                                                         | Проверка переданного архива без установки.                                                   |
| `POST /api/manage/v1/plugins/archive/install?sha256=<sha256>&permissions=<list>&trustedBackend=<bool>&enabled=<bool>` | Установка или обновление переданного архива.                                                 |
| `PUT /api/manage/v1/plugins/:id/enabled` с `{enabled:boolean}`                                                        | `{changed,plugin}`; состояние вступает в силу после перезапуска, если отличается от runtime. |
| `DELETE /api/manage/v1/plugins/:id`                                                                                   | `{changed,restartRequired}`; отсутствие плагина является успешным no-op.                     |

Тело установки официального плагина:

```json
{
  "version": "1.2.3",
  "sha256": "64 lowercase hex characters",
  "permissions": ["storage", "http.routes"],
  "trustedBackend": true,
  "enabled": true
}
```

`version` и `sha256` должны точно совпасть с release из текущего ответа `catalog`. Сервер не обещает
установку исторической версии, которой уже нет в каталоге. `permissions` должен точно совпасть со
списком manifest, а `trustedBackend` — с фактом наличия `manifest.main`; это явное согласие на
возможности и выполнение backend-кода.

Архив передается телом `application/octet-stream`, не JSON. В query `permissions` содержит точный
список через запятую; для пустого списка параметр остается пустым. HMAC текущего протокола не
включает binary body, поэтому ожидаемый SHA-256 и все поля согласия находятся в подписанном query.
Сервер сам вычисляет SHA-256 полученных bytes до inspect/install. Лимиты совпадают с локальной
установкой: архив до 50 МиБ, распакованные данные до 200 МиБ, до 2000 файлов; traversal, дубли и
symlink запрещены. Generic CLI-команда `request` пока предназначена для JSON и не загружает binary
archive.

Повторная установка того же `version`, SHA-256 и `enabled` возвращает `changed:false`. Поля
`enabled`/`archiveSha256` описывают desired installation, а `runningEnabled`/`runningVersion` — код,
уже работающий в процессе. `restartRequired` остается истинным при отличии версии, архива или
состояния и после удаления работающего плагина. Повторный `DELETE` такого уже удалённого плагина
возвращает `changed:false`, но сохраняет `restartRequired:true`, пока старый runtime работает. API
сам gmib не перезапускает. При ошибке записи registry предыдущий каталог плагина и in-memory desired
state восстанавливаются. Постоянные данные в `.data` при удалении сохраняются.

Ошибки lifecycle имеют форму `{error:{code,message}}`. Частые коды: `archive_hash_mismatch`,
`permissions_not_accepted`, `trusted_backend_not_accepted`, `official_release_unavailable`,
`plugin_not_found` и `plugin_capability_required`.

## Standalone helper

[`scripts/gmib-api.mjs`](../../scripts/gmib-api.mjs) запускается обычным Node.js из checkout с
установленными зависимостями и не импортирует Electron или preload. Он не сохраняет session key на
диск: каждый процесс заново выполняет SRP login. Поэтому смена server identifier не оставляет
скрытого stale session; успешный ответ содержит текущий `serverId`.

Задайте стабильный и уникальный `clientId` для контроллера автоматизации:

```bash
export GMIB_BASE_URL=http://gmib-sign-01:9002
export GMIB_CLIENT_ID=ansible-controller-01
read -rsp 'GMIB password: ' GMIB_PASSWORD && printf '\n'
export GMIB_PASSWORD

node scripts/gmib-api.mjs login
node scripts/gmib-api.mjs request --path '/api/screen'
node scripts/gmib-api.mjs request --path '/api/scheduler?playerId=1'
```

Для JSON mutation используйте stdin или файл, чтобы payload не попадал в argv:

```bash
printf '%s\n' '{"name":"Резервный плеер"}' |
  node scripts/gmib-api.mjs request \
    --method POST \
    --path /api/player \
    --body-stdin
```

Пароль разрешено читать из переменной среды, stdin или owner-only файла. Для файла уберите права
группы и остальных пользователей; `0400` и `0600` подходят:

```bash
umask 077
printf '%s' "$GMIB_PASSWORD" > /run/gmib-api.password
node scripts/gmib-api.mjs request \
  --base-url http://gmib-sign-01:9002 \
  --client-id ansible-controller-01 \
  --password-file /run/gmib-api.password \
  --path /api/announce
```

Не передавайте пароль через argv. Переменная среды также видна процессам с достаточными правами; для
production automation предпочтителен временный файл `0600` или stdin из secret store.

Смена пароля принимает текущий пароль из обычного источника, а новый — из отдельного:

```bash
printf '%s' "$GMIB_NEW_PASSWORD" |
  node scripts/gmib-api.mjs password-set \
    --password-file /run/gmib-api.password \
    --new-password-stdin
```

При успехе helper очищает текущую сессию и возвращает `reauthenticateRequired`. При
`revocation_incomplete` новый пароль уже действует: helper переключает свою in-memory credential на
него перед возвратом ошибки. Следующий запрос тем же library client выполняет новый login. Для
нового CLI-процесса укажите уже новый пароль. `rotation_failed` означает, что продолжает действовать
старый.

`--check` не выполняет `password-set` и mutating request; helper возвращает JSON с `skipped:true` и
`changed:false`. Read-only `GET`/`HEAD` в check mode выполняются. Это базовая гарантия отсутствия
side effects. Текущий generic request не сравнивает desired/actual; для идемпотентного применения
ресурсов такое сравнение должен выполнять вызывающий сценарий.

## Формат результата и ошибок

Успех записывается одной JSON-строкой в stdout:

```json
{ "ok": true, "status": 200, "serverId": "...", "data": [] }
```

Диагностика ошибки идет в stderr, machine-readable ошибка — в stdout; exit code ненулевой (`3` для
HTTP 401, `2` для остальных ошибок). Пароль, verifier и session key helper не выводит. HTTP timeout
применяется и к получению headers, и к чтению body. После узнаваемого ответа middleware
`{"identifier":"..."}` helper один раз выполняет новый SRP login и безопасно повторяет запрос:
middleware отклоняет его до обработчика. Другие ответы `401`, включая plugin/application errors,
автоматически не повторяются, чтобы action не выполнился дважды.

Доступные команды и параметры:

```bash
node scripts/gmib-api.mjs --help
```
