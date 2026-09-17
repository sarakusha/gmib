# Пример автоматизации GMIB через Ansible

[`examples/ansible/gmib.yml`](../../examples/ansible/gmib.yml) — небольшой playbook для контроллера,
на котором есть checkout GMIB с установленными Node.js dependencies. Он запускает standalone SRP
helpers локально на контроллере; управляемый GMIB остается HTTP-целью и не обязан иметь Ansible или
исходники.

Пример применяет каждый экран, плеер, плейлист, mapping и scheduler отдельным вызовом
[`gmib-api-resources.mjs`](../../scripts/gmib-api-resources.mjs), частично меняет параметры яркости,
управляет lifecycle плагинов и может вызвать явно указанный plugin-owned settings route. Это не
Ansible collection и не универсальный граф зависимостей.

## Подготовка и запуск

Скопируйте [`vars.example.yml`](../../examples/ansible/vars.example.yml) за пределы checkout и
замените адрес, client ID и desired state. Пароль не записывайте в этот файл и не передавайте через
command line. В CI загрузите его из secret store в environment; для интерактивного запуска:

```bash
cd /path/to/gmib
read -rsp 'GMIB password: ' GMIB_PASSWORD && printf '\n'
export GMIB_PASSWORD

ansible-playbook \
  -i examples/ansible/inventory.yml \
  examples/ansible/gmib.yml \
  --extra-vars @/secure/path/gmib-vars.yml
```

Все задачи с password environment и ответами API помечены `no_log`. `gmib_client_id` должен быть
стабильным и уникальным для этого контроллера. Inventory описывает локальное выполнение helper;
`gmib_base_url` указывает на GMIB.

## Desired resources и зависимости

`gmib_resources` — упорядоченный список пар `{type, desired}`. Допустимые type: `screen`, `player`,
`playlist`, `mapping`, `scheduler`, `gmib-scheduler`. Формат selector, поддержанные поля, проверки
ссылок и частичные ошибки описаны в [management-resources.md](management-resources.md).

Server-generated ID нельзя угадывать по порядку создания. `gmib_linked_resources` реализует один
явный небольшой поток playlist → player → mapping/player scheduler: каждый следующий шаг получает
фактический `id` из JSON результата предыдущего ensure. Это не generic graph engine. Для других
ссылок сначала примените ресурс по точному имени и сохраните возвращенный `id`. В `--check`
отсутствующая зависимость не получает вымышленный ID: playbook показывает pending и продолжает ее
только после реального create.

Обычный повтор playbook не вызывает runtime actions `.../run`, output show/hide, смену пароля,
активацию, license retry или relaunch без явной opt-in переменной. Поэтому совпадающий desired state
дает `changed=0`.

## Check mode

```bash
ansible-playbook \
  -i examples/ansible/inventory.yml \
  examples/ansible/gmib.yml \
  --extra-vars @/secure/path/gmib-vars.yml \
  --check
```

Resource task передает helper параметр `--check`: он выполняет SRP login, GET, selector и проверки
ссылок, затем возвращает честный `predicted:create|update|delete` без POST/PUT/DELETE. Параметры
яркости вызывают `PATCH /api/manage/v1/settings?dryRun=true`, поэтому сервер выполняет полную
валидацию и вычисляет `changed`, но не пишет config и не рассылает runtime update.

Plugin lifecycle в check mode читает `PluginStatus` и сравнивает pin, consent и enabled. У уже
удаленного с диска плагина GET не показывает старый runtime; playbook сообщает, что без idempotent
DELETE нельзя узнать tombstone `restartRequired`. DELETE в check mode не отправляется. Plugin-owned
settings сравниваются только по явно указанному partial-PATCH контракту конкретного плагина.

## Плагины и перезапуск

`gmib_plugins` использует generic lifecycle `/api/manage/v1/plugins`: official pin содержит точные
`version`, SHA-256, permissions, `trustedBackend` и desired `enabled`. Playbook учитывает как
результат mutation, так и уже сохраненный `PluginStatus.restartRequired`. Это позволяет безопасно
повторить запуск после сбоя между установкой и relaunch. Для `state: absent` обычный apply всегда
выполняет idempotent DELETE, чтобы сервер мог сообщить о работающем до перезапуска удаленном
runtime.

Если задано `gmib_relaunch_when_required: true`, playbook вызывает relaunch только при фактическом
`restartRequired`, а затем ждет нового SRP login и read-back без pending plugin statuses. Ресурсы,
параметры GMIB и plugin-owned settings применяются после этого. Без разрешенного relaunch попытка
настроить route только что установленного плагина завершается понятной ошибкой.

`gmib_plugin_settings` не означает общий `/settings`. Этот пример намеренно поддерживает только
контракт «authenticated GET возвращает mapping под `response_key`, PATCH принимает partial mapping,
повторный GET возвращает примененные значения». Каждый элемент содержит явный
`/api/plugins/{id}/...` path, response key и desired JSON из документации конкретного плагина. После
PATCH playbook выполняет GET read-back и завершает задачу ошибкой, если requested partial values не
сохранились. Плагин может публиковать собственную authenticated схему по
`/api/plugins/{id}/openapi.json`; наличие и версия этой схемы принадлежат плагину и не требуют
выпуска host API. Dynamic plugin routes намеренно не входят в основной OpenAPI GMIB.

## Одноразовые операции

Активация, повтор уже настроенной лицензии и смена пароля выключены по умолчанию:

```yaml
gmib_activate: false
gmib_license_retry: false
gmib_rotate_password: false
```

Включайте их только для отдельного запуска и сразу возвращайте в `false`. Для activation передайте
`gmib_activation: {key: ..., name: ...}` через Ansible Vault/secret store. Для смены пароля задайте
`GMIB_NEW_PASSWORD`; оба секрета защищены `no_log`. Playbook не вызывает внешний license service при
обычном apply. После activation/license retry он ждет authenticated `/api/announce` со статусом
`active`; после смены пароля проверяет новый SRP login.

Ошибку после частично принятой resource mutation не следует обходить повторным POST вручную. Helper
возвращает `partial:true`, `id`/`createdId` и `operations`; повторите тот же desired selector. Exact
name или сохраненный ID позволяют завершить update без дублирования уже созданного ресурса.
