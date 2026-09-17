# Идемпотентное применение существующих ресурсов GMIB

[`scripts/gmib-api-resources.mjs`](../../scripts/gmib-api-resources.mjs) применяет ровно один
существующий тип ресурса за запуск: `screen`, `player`, `playlist`, `mapping`, `scheduler` или
`gmib-scheduler`. Он использует SRP/HMAC-клиент из `scripts/gmib-api-client.mjs` и исходные `/api/*`
routes; новый CRUD, запуск Electron и доступ к устройствам не нужны.

Перед записью helper читает текущий ресурс, разрешает selector и проверяет ссылки, относящиеся к
конкретному ресурсу. В ответе одна JSON-строка: `changed`, `resource`, `id` и фактически выполненные
`operations`. При повторном применении совпадающего desired ответа будет `changed:false`.

## Запуск

Стабильные `GMIB_BASE_URL`, `GMIB_CLIENT_ID` и пароль задаются так же, как для основного helper.
Пароль нельзя передавать в argv: используйте `GMIB_PASSWORD`, stdin или owner-only файл.

```bash
export GMIB_BASE_URL=http://gmib-sign-01:9002
export GMIB_CLIENT_ID=ansible-controller-01
read -rsp 'GMIB password: ' GMIB_PASSWORD && printf '\n'
export GMIB_PASSWORD

node scripts/gmib-api-resources.mjs ensure \
  --type screen \
  --desired-file /etc/gmib/desired-screen.json
```

`--desired-stdin` заменяет `--desired-file`; их нельзя применять вместе. Полный список параметров:

```bash
node scripts/gmib-api-resources.mjs --help
```

## Selector и удаление

`id` выбирает ровно один существующий ресурс. `name` выбирает ровно один ресурс с точным именем;
несколько совпадений — ошибка, а не создание имени с автоматическим suffix. Для `screen`, `player`,
`playlist` и `mapping` ID генерирует сервер: отсутствующий явно заданный числовой `id` — ошибка,
поэтому initial create задавайте по `name` и сохраняйте возвращенный `id`. Scheduler принимает свой
строковый `id` при POST; если он не задан, GMIB создаст его и вернет в результате.

Если present desired одновременно содержит `id` и новое `name`, helper до записи отклоняет имя,
занятое другим ресурсом. Так legacy `unique*Name` API не сможет незаметно переименовать ресурс с
suffix.

Удаление требует явного `state: "absent"`. Обычный `state: "present"` ничего не удаляет и не
является prune-операцией.

```json
{ "id": 12, "state": "absent" }
```

## Экраны, плееры, плейлисты и mapping

В desired передаются только поддерживаемые поля ресурса. Частичный desired безопасен: перед `PUT`
helper объединяет его с `GET`, чтобы не стереть omitted поля. Для экрана при создании обязательны
`name`, `left` и `top`; `useExternalKnob:true` нельзя сочетать с ненулевым `brightnessFactor`.

`POST /api/screen` не поддерживает `addresses` и `brightness`: адреса не сохраняются, а brightness
не входит в INSERT и может быть отклонен драйвером при bind-параметрах. Helper создаст экран без
этих полей, проверит ответ и выполнит завершающий `PUT` с прочитанными полями. Если этот `PUT` не
удался, ошибка содержит `createdId` и `operations:["create"]`: повторите команду с этим ID или тем
же exact name, чтобы не создавать дубль.

```json
{
  "name": "Основной экран",
  "left": 0,
  "top": 0,
  "width": 1920,
  "height": 1080,
  "addresses": ["10.20.0.10"],
  "brightness": 70
}
```

Для плеера `playlistId` проверяется по существующему плейлисту, а непустой `current` должен быть ID
item в его candidate playlist; для mapping проверяется `player`. Плейлист сравнивает `items` по
`md5`, `flags`, `start` и `duration` в заданном порядке, игнорируя сгенерированные item ID. При
изменении порядка сохраняются ID совпадающих элементов, а новые получают новый ID. Каждый `md5`
desired-плейлиста должен уже присутствовать в `/api/media`.

## Планировщики

Оба scheduler types используют существующие `/api/scheduler` и `/api/gmib-scheduler`; helper никогда
не вызывает `.../run`. Укажите полный набор scheduling/action полей при первом создании. Для
последующих обновлений можно передать только изменяемые поля: runtime state (`lastRunAt`,
`lastStatus`, `nextRunAt` и подобные) не сравнивается и не записывается.

`kind:"once"` требует корректный `runAt`; helper приводит его к ISO timestamp. `kind:"cron"` хранит
объект `seconds`, `minutes`, `hours`, `days`, `months`, `weekdays`, а не Unix cron string.
Отсутствующий `seconds` нормализуется к нулевой секунде; selected массивы сортируются и deduplicate,
`priority` приводится к целому, а GMIB scheduler использует локальное время хоста без timezone поля.
Helper проверяет допустимые значения: seconds/minutes `0..59`, hours `0..23`, days `1..31`, months
`1..12`, weekdays `0..6`; `select` требует непустой selected. Неизвестные поля cron/part
отклоняются, чтобы не создать задание, которое runtime никогда не выполнит.

Для player scheduler проверяется `playerId`, а `load-playlist` также `playlistId`. Для GMIB
scheduler `show-test` требует существующие `screenId` и `testId`, `hide-test` — `screenId`,
`set-brightness` — brightness (округляется и ограничивается 0..100), а auto-brightness/overheat
actions требуют `enabledValue`.

## Check mode

`--check` выполняет те же чтения, selector и проверки ссылок, но не отправляет `POST`, `PUT` или
`DELETE`. При отличии он честно возвращает `changed:true`, `checkMode:true` и `predicted` (`create`,
`update` или `delete`). Никаких configuration writes, prune и run-now в этом режиме нет.

Если write уже был принят, но readback не подтвердил desired, JSON-ошибка содержит `id`, выполненные
`operations`, `changed:true` и `partial:true`. Для screen follow-up также есть `createdId`.

Plugin API намеренно не входит в этот helper: plugin-owned schemas и маршруты могут развиваться без
новой версии host. Для них используйте raw `scripts/gmib-api.mjs request` по документации
конкретного плагина.
