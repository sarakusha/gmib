# REST API для автоматизации GMIB

Этот документ описывает существующий REST API GMIB и standalone helper для скриптов и Ansible.
Полный второй CRUD в `/api/manage/v1` не создается: экраны, плееры, плейлисты, привязки и оба
планировщика уже доступны через маршруты `/api/*`. Namespace `/api/manage/v1` используется только
для недостающих административных операций, пока это смена общего пароля.

## Адрес и защита

HTTP API слушает порт `NIBUS_PORT + 1`, по умолчанию `9002`. В helper передается origin без `/api`,
например `http://gmib-sign-01:9002`. Сетевой клиент выполняет SRP login, проверяет доказательство
`M2`, затем подписывает каждый запрос HMAC-SHA256. В подпись входят метод, фактический path вместе с
query, timestamp и непустое JSON-тело. Допустимое расхождение часов обычно составляет пять минут.

SRP и HMAC не шифруют HTTP-трафик. Для недоверенной сети нужен VPN или TLS-прокси. Схема протокола,
формат ошибок и смена пароля подробно описаны в [rest-api-auth.md](rest-api-auth.md).

## Карта существующих маршрутов

Все перечисленные маршруты доступны в текущем API. Ответы и тела — JSON, если в таблице не указано
иное. Мутации обычных ресурсов требуют действующей лицензии; чтение разрешено до активации, но
по-прежнему требует авторизации. Пустой успешный ответ может иметь статус `200` или `204` в
зависимости от маршрута.

| Область                   | Маршруты                                                                                                                                                   | Тело и результат                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Идентификация             | `GET /api/identifier`                                                                                                                                      | Строковый identifier сервера; маршрут свободен от авторизации.                                                                                                            |
| Состояние и лицензия      | `GET /api/announce`                                                                                                                                        | Состояние лицензии, версия, платформа, `autostart`, `exactWindowPlacement`. Не используйте поля legacy `announce`/`iv` как новый контракт.                                |
| Активация                 | `POST /api/activate`                                                                                                                                       | `{key, name?}`; успешный запрос инициирует перезапуск. Ключ передавайте через защищенный JSON input helper, не через argv.                                                |
| Повтор лицензии           | `POST /api/license/retry`                                                                                                                                  | Без тела; `409`, если действующая лицензия не получена.                                                                                                                   |
| Экраны                    | `GET /api/screen`, `GET /api/screen/:id`, `POST /api/screen`, `PUT /api/screen`, `DELETE /api/screen/:id`                                                  | `Screen`; create принимает как минимум `{name}`, update — объект с `id`. Ответы create/update возвращают фактический объект.                                              |
| Перезагрузка вывода       | `PUT /api/screen/:id/reload`                                                                                                                               | Перезагружает уже открытое окно экрана, `404`, если его нет.                                                                                                              |
| Дисплеи                   | `GET /api/display`                                                                                                                                         | Массив Electron display descriptors; значения зависят от текущей ОС и сессии.                                                                                             |
| Плееры                    | `GET /api/player`, `GET /api/player/:id`, `POST /api/player`, `PUT /api/player`, `DELETE /api/player/:id`                                                  | `Player`; update требует числовой `id`, create/update возвращают фактический объект.                                                                                      |
| Управление выводом плеера | `PUT /api/player/:id/stop`, `PUT /api/player/:id/output`, `DELETE /api/player/:id/output`                                                                  | Для visibility: `{visible:boolean}`. Это runtime action, а не сохранение desired state.                                                                                   |
| Плейлисты                 | `GET /api/playlist`, `GET /api/playlist/:id`, `POST /api/playlist`, `PUT /api/playlist`, `DELETE /api/playlist/:id`                                        | `CreatePlaylist`/`Playlist`, включая `items`.                                                                                                                             |
| Элементы плейлиста        | `PATCH /api/playlist/:id`                                                                                                                                  | Либо `{insert:[mediaMd5,...]}`, либо `{remove:itemId}`; возвращает плейлист целиком.                                                                                      |
| Медиатека                 | `GET /api/media`, `GET /api/media/:md5`, `POST /api/media`, `DELETE /api/media/:md5`                                                                       | Upload — multipart, остальные ответы используют `MediaInfo`. Generic JSON helper пока не загружает multipart-файлы.                                                       |
| Привязки                  | `GET /api/mapping`, `POST /api/mapping`, `PUT /api/mapping`, `DELETE /api/mapping/:id`                                                                     | `PlayerMapping`; create/update возвращают фактическую привязку.                                                                                                           |
| Планировщик плеера        | `GET /api/scheduler?playerId=`, `POST /api/scheduler`, `PUT /api/scheduler/:id`, `POST /api/scheduler/:id/run`, `DELETE /api/scheduler/:id`                | `PlayerSchedulerJobInput`/`PlayerSchedulerJob`. Query входит в HMAC.                                                                                                      |
| Планировщик GMIB          | `GET /api/gmib-scheduler`, `POST /api/gmib-scheduler`, `PUT /api/gmib-scheduler/:id`, `POST /api/gmib-scheduler/:id/run`, `DELETE /api/gmib-scheduler/:id` | `GmibSchedulerJobInput`/`GmibSchedulerJob`. Actions включают тест, яркость и автояркость.                                                                                 |
| Яркость NovaStar          | `PUT /api/novastar/screens/brightness`                                                                                                                     | `{path, screen?:number, value, persist?:boolean}`; runtime доступен только с соответствующей license capability. Сохранение в контроллер не является read-back проверкой. |
| Системные параметры       | `POST /api/autostart`, `POST /api/exactWindowPlacement`                                                                                                    | `{value:boolean}`; `exactWindowPlacement` инициирует перезапуск.                                                                                                          |
| Перезапуск                | `POST /api/relaunch`                                                                                                                                       | Action без тела.                                                                                                                                                          |
| Страницы вывода           | `GET /api/pages`, `POST /api/pages`, `PUT /api/pages/:id`, `DELETE /api/pages/:id`                                                                         | `Page`; update берет `id` из path.                                                                                                                                        |
| Plugin runtime            | `/api/plugins/:pluginId/*`                                                                                                                                 | Маршруты определяет сам установленный plugin с `access: "authenticated"`. Это не lifecycle API; раздел Plugins требует лицензию Plus или выше.                            |
| Смена пароля              | `PUT /api/manage/v1/auth/password`                                                                                                                         | `{salt, verifier}`; helper принимает новый пароль локально и вычисляет эти параметры сам. Маршрут доступен до активации лицензии.                                         |

Основные DTO находятся в [`packages/common/video.ts`](../../packages/common/video.ts),
[`packages/common/playlist.ts`](../../packages/common/playlist.ts),
[`packages/common/scheduler.ts`](../../packages/common/scheduler.ts) и
[`packages/common/mediaInfo.ts`](../../packages/common/mediaInfo.ts). Серверные обработчики являются
окончательным источником поведения: [`packages/main/src/api.ts`](../../packages/main/src/api.ts) и
[`packages/main/src/novastarApi.ts`](../../packages/main/src/novastarApi.ts).

В текущем API отсутствуют:

- noninteractive install/update/enable/disable/uninstall plugin;
- единый проверенный контракт настройки plugin;
- GET/PATCH разрешенных параметров конфигурации, включая параметры и флаг автояркости.

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
