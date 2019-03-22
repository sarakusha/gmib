## Установка
### node.js
Требуется установить актуальную версию [node.js](https://nodejs.org).
Для <b>*nix</b> систем рекомендуется использовать [Node Version Manager (nvm)](https://github.com/creationix/nvm).
Просто запустите скрипт с помощью curl
```bash
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
```
или wget
```bash
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
```
Закройте терминал и откройте его опять. Установите node.js нужной версии, например
```bash
nvm install 10
nvm alias default node
```
На **Windows** можно использовать  [официальный установщик](https://nodejs.org/en/download/current/). Необходимо перезагрузить **Windows** после установки.

После установки node.js обновите `npm` и укажите репозиторий *Nata-Info* <small>(только внутри сети Nata-Info)</small>
```bash
npm i -g npm
npm set registry http://192.168.20.111:4873
```

Выполните 
### Ubuntu
1. Убедитесь что установлен [Python 2.7](https://www.python.org/downloads/) <sub><sup>(требуется для node-gyp)</sup></sub>
2. `sudo apt-get install -y build-essential libudev-dev`

### macOS
1. [Python 2.7](https://www.python.org/downloads/)
2. [Xcode](https://developer.apple.com/xcode/download/)
3. Command Line Tools `xcode-select --install`

### Windows
* Устанвите [git](https://gitforwindows.org/)
* #### Опция 1 (автоматически)
  Установка всех утилит используя [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools)

  `npm i -g --production windows-build-tools`
* #### Опция 2 (вручную)
  * [Visual Studio Build Tools](https://visualstudio.microsoft.com/thank-you-downloading-visual-studio/?sku=BuildTools)
  * [Python 2.7](https://www.python.org/downloads/)
  * `npm config set msvs_version 2017`

## Установка/обновление пакета `@nata/nibus.js`
Чтобы установить или обновить пакет выполните команду
```bash
npm i -g @nata/nibus.js
```
Перед обновлением остановите службу `nibus stop`
## Запуск сервиса `nibus.js` и команды
* запуск
```bash
nibus start
```
* остановка
```bash
nibus stop
```
* справка
```bash
nibus --help
nibus <команда> --help
```
* список подключенных устройств
```bash
nibus list
```
* дамп непосредственно подключенных устройств
```bash
nibus dump
```
* дамп устройств за `Siolunx` с указанным `mib` или адресом  `mac`
```bash
nibus dump --mib pconsole
nibus dump --mac ::23:56
```
* чтение одной переменной
```bash
nibus read --mac ::45:35 --id brightness
```
* запись переменных
```bash
nibus write --mac ::56:78 brightness=23 hofs=100 vofs=300
```
* выгрузка домена
```bash
nibus upload --mac 255.255.1 --domain MODUL --size 6 --hex
```
* загрузить домен
```bash
nibus download --mac ::23:74 --domain NVRAM --src data.bin --offset=1024
```
* посмотреть лог
```bash
nibus log --level hex
nibus log --level nibus --omit priority
```
* залить прошивку в нулевой модуль и выполнть update
```bash
nibus flash -m ::1 -k ctrl moduleSelect=0 --src Slim_Ctrl_v5_Mcu_v1.2.txt --exec update
```

