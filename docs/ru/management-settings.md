# Параметры яркости через Management API

Маршрут заготовлен в `packages/main/src/managementSettingsRouter.ts` и подключается приложением под
`/api/manage/v1`:

```text
GET   /api/manage/v1/settings
PATCH /api/manage/v1/settings?dryRun=true|false
```

Роутер принимает обязательную зависимость `strictAuth` и ставит ее первым middleware. Поэтому
подключение должно передать существующую проверку SRP/HMAC; `unsafeMode` не должен обходить эту
проверку. При подключении в `api.ts` сохраняются также общий auth middleware и существующий license
mutation guard. Сам роутер не импортирует `nibus`, Electron, auth или license state.

GET возвращает только разрешенные ключи конфигурации:

```json
{
  "brightness": 30,
  "autobrightness": false,
  "location": { "latitude": 55.75, "longitude": 37.62 },
  "spline": [
    [10, 10],
    [10000, 80]
  ],
  "sunSpline": [
    ["event:dawn", 10],
    ["event:solarNoon", 80]
  ],
  "nightMode": { "start": "22:00", "end": "06:00", "brightness": 10 }
}
```

Не заданные optional-поля отсутствуют в JSON. PATCH принимает JSON-объект только с этими шестью
ключами. `brightness` и значения кривых находятся в диапазоне `0..100`, координаты — в пределах
широты `-90..90` и долготы `-180..180`, а время имеет формат `HH:MM`. `spline` содержит 2–4 точки с
возрастающим lux и неубывающей яркостью. `sunSpline` содержит не более 10 уникальных ссылок
`event:*` или `time:HH:MM`. Неизвестные поля, query-параметры и неверные значения получают `400` с
кодом `invalid_settings`.

PATCH сохраняет только переданные значения. `location` и `nightMode` объединяются с текущим объектом
на один уровень, поэтому можно передать одну координату или одну часть существующего ночного режима.
Если `nightMode` создается впервые, после объединения должны присутствовать `start`, `end` и
`brightness`; уже существующий полный режим можно менять частично. Для очистки optional-поля
передайте `null`. Для `spline` и `sunSpline` значение `null` означает `reset-to-default`: применяются
defaults из существующей `configSchema`; это позволяет повторять такой PATCH идемпотентно. Массивы
с явным значением заменяются целиком.

Ответ PATCH имеет вид:

```json
{
  "changed": true,
  "dryRun": false,
  "settings": { "brightness": 40, "autobrightness": false }
}
```

Повторная запись тех же значений возвращает `changed: false` и не вызывает `updateConfigStore`. При
`dryRun=true` выполняются те же проверки и вычисляется read-back, но конфигурация и уведомление
runtime не меняются. Успешный PATCH сохраняет конфигурацию через переданный adapter и вызывает
обычный `updateConfigStore`, поэтому связанный renderer/runtime получает broadcast при фактическом
подключении.

Эта часть API изменяет только параметры конфигурации. Переключатель `autobrightness` не переносит
алгоритм расчета, таймеры, перегрев, HID или команды NovaStar в HTTP boundary. Фактическое
применение яркости по датчику/солнцу остается в renderer/runtime и зависит от наличия датчика,
корректной локации и обычного жизненного цикла GMIB. Роутер в этой ветке еще не смонтирован в
production API, поэтому до интеграции endpoint недоступен, а auth и license guards не выполняются
автоматически.
