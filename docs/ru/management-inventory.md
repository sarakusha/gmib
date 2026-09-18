# Saved hosts и Ansible inventory

`scripts/gmib-api-inventory.mjs` синхронизирует только сохраненные GMIB hosts. Обнаруженные
устройства выводятся командой `list` для наблюдения, но не попадают в export, не являются источником
удаления и не меняют сохраненную конфигурацию.

```sh
node scripts/gmib-api-inventory.mjs list --base-url http://gmib.local:9002 --client-id inventory --password-env GMIB_PASSWORD
```

Команда использует тот же SRP-клиент, что и остальные management helpers. Пароль передавайте через
защищенную переменную окружения, owner-only файл или stdin; не добавляйте его в inventory.

## Поля inventory

В scope группы `gmib` (включая ее дочерние группы) helper читает только эти поля:

| Поле              | Назначение                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `gmib_address`    | Адрес устройства GMIB: IPv4, IPv6 или hostname.                                           |
| `gmib_nibus_port` | NiBUS port, от `1` до `65534`; по умолчанию `9001`.                                       |
| `gmib_saved_name` | Необязательное отображаемое имя saved host.                                               |
| `gmib_api_url`    | Проверяется как HTTP(S) URL; generated overlay выводит native GMIB HTTP URL для endpoint. |

`ansible_host` задает SSH-транспорт и не заменяет `gmib_address`. Helper не записывает
`ansible_connection`, `ansible_host`, SSH-пользователей, ключи, пароли или Vault-поля. В частности,
он никогда не генерирует `ansible_connection: local`.

Адрес и порт образуют endpoint identity. Переезд на другой endpoint — это добавление и удаление, а
не переименование по `name`.

## Отдельный managed overlay

Экспорт создает отдельный JSON overlay и, при `--baseline`, baseline. Исходный INI/YAML inventory не
изменяется.

```sh
node scripts/gmib-api-inventory.mjs export \
  --output inventory/gmib-managed.json \
  --baseline state/gmib-baseline.json \
  --apply --base-url http://gmib.local:9002 --client-id inventory --password-env GMIB_PASSWORD
```

Для **операционного** inventory подключайте исходный SSH inventory первым, а generated overlay
последним. Тогда playbook получает актуальные GMIB-поля, включая имя после удаленного
переименования, при сохранении SSH-полей из исходного inventory:

```sh
ansible-inventory --list \
  -i inventory/hosts.yml \
  -i inventory/gmib-managed.json
```

Generated `gmib_api_url` всегда является native HTTP URL
`http://gmib_address:(gmib_nibus_port + 1)`; он не моделирует произвольный HTTPS proxy. Передавайте
operational override для такого proxy явно, например через Ansible extra vars.

Для **наблюдения изменений в sync** порядок обратный: overlay первым, editable source последним. Так
helper видит изменение исходного `gmib_saved_name`, но не принимает собственное generated значение
за ручную правку. При повторном `sync` с `--inventory` helper требует этот порядок, если managed
overlay уже существует:

```sh
node scripts/gmib-api-inventory.mjs sync \
  --inventory inventory/gmib-managed.json \
  --inventory inventory/hosts.yml \
  --output inventory/gmib-managed.json \
  --baseline state/gmib-baseline.json \
  --apply --base-url http://gmib.local:9002 --client-id inventory --password-env GMIB_PASSWORD
```

Вместо запуска `ansible-inventory` можно передать заранее подготовленный стандартный `--list` JSON
через `--inventory-json snapshot.json`. Ошибки `ansible-inventory` намеренно не печатают stdout,
hostvars или stderr: в них могут быть секреты.

## Направления и конфликты

`import` добавляет или обновляет endpoints из inventory в GMIB и не удаляет существующие saved
hosts:

```sh
node scripts/gmib-api-inventory.mjs import \
  --inventory inventory/gmib-managed.json --inventory inventory/hosts.yml \
  --apply --base-url http://gmib.local:9002 --client-id inventory --password-env GMIB_PASSWORD
```

`sync` ведет baseline из последнего успешного состояния. В первом запуске новые endpoints с одной
стороны объединяются. Если один endpoint получил разные `gmib_saved_name`, helper останавливается до
записи. Выберите сторону явно только после проверки:

```sh
node scripts/gmib-api-inventory.mjs sync \
  --inventory inventory/gmib-managed.json --inventory inventory/hosts.yml \
  --output inventory/gmib-managed.json --baseline state/gmib-baseline.json \
  --conflict inventory-wins --apply \
  --base-url http://gmib.local:9002 --client-id inventory --password-env GMIB_PASSWORD
```

Допустимые политики: `fail`, `gmib-wins`, `inventory-wins`. Одностороннее исчезновение endpoint
относительно baseline считается конфликтом. Автоматического удаления и `run-now` нет; удаление
выполняйте отдельной проверенной операцией, затем создайте новый baseline/export.

Baseline хранит и сохраненное состояние, и последний наблюдаемый editable inventory. Поэтому
GMIB-переименование не откатывается на следующем запуске только потому, что generated overlay имеет
более низкий приоритет, а настоящее изменение исходного inventory распространяется один раз и затем
становится стабильным.

## Проверка и восстановление записи

Все изменения требуют `--apply`. `--check` выполняет чтения и при необходимости signed
`PUT?dryRun=true`, но не меняет saved hosts, overlay, baseline или lock-файлы. Результат JSON
содержит `changed`, `checkMode`, revision и planned actions.

Output имеет ownership marker рядом с ним. Helper откажется перезаписывать существующий unmanaged
JSON, другой source binding или символическую ссылку. На время `--apply` он удерживает exclusive
lock. Запись overlay, marker и baseline выполняется через temporary file и rename; journal позволяет
повторить ту же операцию после сбоя marker или baseline. Если remote PUT успел примениться, а запись
файлов не завершилась, JSON-ошибка содержит `partial`, `savedApplied`, revision и пути. Исправьте
проблему с файловой системой и повторите тот же desired state; не подменяйте output вручную.
