# Образ GMIB kiosk для Ubuntu x86

В этой папке находится сборщик установочного образа Ubuntu Server 24.04 для выделенного GMIB-плеера.
Образ устанавливает минимальную систему, GMIB AppImage, Cage, Pritunl Client и SSH. После первого
запуска оператор вводит короткий одноразовый код, устройство получает собственный VPN-профиль из
`app-server` и запускает GMIB без рабочего стола и курсора мыши.

## Что потребуется

- официальный `ubuntu-24.04.4-live-server-amd64.iso` с проверенной SHA-256;
- релизный `gmib-x86_64.AppImage` из workflow `Release`;
- пакет `pritunl-client_*_amd64.deb` для Ubuntu Noble;
- публичный SSH-ключ администратора, например `~/.ssh/id_ed25519.pub`;
- `xorriso`, `dpkg-deb`, `sha256sum`, `openssl`, `file`, `awk` и `sed`.

Для текущего проверенного ISO Ubuntu используется SHA-256:

```text
e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433
```

На Ubuntu установите инструменты командой `sudo apt-get install xorriso`. Пакет Pritunl можно
скачать на машине Ubuntu amd64, не меняя её постоянную APT-конфигурацию:

```bash
deploy/kiosk/download-pritunl-client-deb.sh dist
```

На macOS инструменты сборки можно установить через Homebrew:

```bash
brew install xorriso dpkg coreutils openssl@3
```

Скрипт загрузки Pritunl предназначен для Ubuntu amd64, но полученный `.deb` можно затем перенести на
Mac и использовать при сборке ISO.

## Сборка образа

Запускайте команду из корня репозитория GMIB. Пример с текущими локальными файлами:

```bash
deploy/kiosk/build-autoinstall-iso.sh \
  --base-iso /Users/sarakusha/Downloads/ubuntu-24.04.4-live-server-amd64-2.iso \
  --base-iso-sha256 e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433 \
  --appimage /private/tmp/gmib-release-33874705959/gmib-x86_64.AppImage \
  --gmib-version 5.4.1 \
  --pritunl-deb /private/tmp/pritunl-client_1.3.4729.52-0ubuntu1~noble_amd64.deb \
  --bootstrap-url https://app.nata-info.ru/api/vpn/enroll/gmib \
  --ssh-authorized-key /Users/sarakusha/.ssh/id_ed25519.pub \
  --output /Users/sarakusha/Downloads/gmib-kiosk-5.4.1-ubuntu-24.04.4-amd64.iso
```

Пути к AppImage и `.deb` меняются при выпуске новых версий. Выходной файл не должен существовать до
запуска сборки. Скрипт проверит архитектуру входных файлов и контрольную сумму Ubuntu, а рядом с ISO
создаст файл `.sha256`. Имя формируется по правилу
`gmib-kiosk-<версия GMIB>-ubuntu-<версия Ubuntu>-amd64.iso`; версии также записываются внутрь
установленной системы в `/etc/gmib/image-release`.

В образ записываются только публичный URL enrollment-сервиса и публичный SSH-ключ. Pritunl API
Token, API Secret и общий VPN-профиль туда не попадают. Для обычного сертификата Let's Encrypt
параметр `--bootstrap-tls-pin` не нужен: используется стандартная проверка HTTPS, которая не
ломается при плановой смене сертификата.

## Запись и установка

1. Запишите полученный ISO на USB-флешку с помощью BalenaEtcher.
2. Загрузите плеер с этой флешки.
3. Дождитесь выключения после автоматической установки.
4. Извлеките флешку и включите устройство.
5. На экране первичной настройки введите одноразовый код GMIB.
6. После подключения VPN устройство перезагрузится и автоматически запустит GMIB в Cage.

**Установка полностью стирает выбранный диск без подтверждения.** По умолчанию выбирается самый
большой диск, не являющийся установочной флешкой. Такой режим предназначен для плеера с одним
внутренним SATA, NVMe или eMMC-диском. Если внутренних дисков несколько, соберите отдельный образ с
одним из параметров `--target-disk`, `--target-model` или `--target-serial`.

## Одноразовые коды

### Добавление организации

Организацию сначала создают в административной панели Pritunl. Скрипты `app-server` не создают
организации, а связывают уже существующую организацию с продуктом.

После создания организации подключитесь к серверу и получите её ID:

```bash
ssh user@app.nata-info.ru
cd ~/src/app-server
nvm use
npm run enrollment:organizations
```

Команда выводит только названия и ID организаций, не выводя API Token или Secret. Затем привяжите
продукты к нужному ID. Одна организация может обслуживать несколько продуктов:

```bash
npm run enrollment:configure-product -- gmib <PRITUNL_ORGANIZATION_ID>
npm run enrollment:configure-product -- ggs <PRITUNL_ORGANIZATION_ID>
pm2 restart app-server --update-env
pm2 save
```

Если после `nvm use` команда `pm2` не найдена, установите PM2 для активной версии Node и повторите
перезапуск:

```bash
npm install --global pm2@7.0.1
pm2 restart app-server --update-env
pm2 save
```

nvm хранит глобальные пакеты отдельно для каждой версии Node, поэтому PM2 нужно устанавливать снова
после перехода на новую версию Node.js.

Например, сейчас и `gmib`, и `ggs` привязаны к организации `mcd`. Клиенты различаются по префиксам
`gmib-...` и `ggs-...`, а одноразовые коды всегда относятся только к одному продукту.

### Создание кодов

Коды создаются на `app-server` отдельно для каждого продукта. Например, десять кодов GMIB на 60
минут:

```bash
cd ~/src/app-server
nvm use
npm run enrollment:create -- gmib 10 60
```

Первое устройство, использовавшее код, атомарно привязывает его к своему hardware ID. Повторное
обращение того же устройства разрешено до истечения кода, например если загрузка профиля оборвалась.
Другому устройству этот код уже не подойдёт. В Pritunl создаётся отдельный клиент с именем
`gmib-<12 hex>` в организации `mcd`.

## Когда пересобирать ISO

Создавайте новый образ после выпуска нового GMIB AppImage, обновления Pritunl Client, изменения
скриптов из этой папки или смены базового Ubuntu ISO. Постоянно пересобирать образ из-за обновления
`app-server` не требуется, пока URL и контракт `/api/vpn/enroll/gmib` остаются совместимыми.

## Публикация на app-server

ISO значительно больше допустимого размера одного файла GitHub Releases, поэтому AppImage продолжает
загружаться с GitHub, а готовые kiosk-образы хранятся на `app.nata-info.ru`. После сборки
опубликуйте образ командой:

```bash
deploy/kiosk/publish-image.sh \
  --iso /Users/sarakusha/Downloads/gmib-kiosk-5.4.1-ubuntu-24.04.4-amd64.iso
```

Скрипт повторно проверяет SHA-256, оставляет на сервере не менее 2 ГБ свободного места, загружает
ISO сначала во временное имя и только после завершения делает его доступным. Каталог образов
открывается по адресу `https://app.nata-info.ru/gmib/kiosk`.

Один образ занимает примерно 3,3 ГБ. На текущем сервере нужно хранить не более двух актуальных
образов либо заранее расширить диск. Старые файлы автоматически не удаляются.
