# Changelog
> **Tags:**
>
> - [New Feature]
> - [Bug Fix]
> - [Breaking Change]
> - [Documentation]
> - [Internal]
> - [Polish]
> - [Experimental]
> - [Deprecation]
# 1.3.6
- **Internal**
  - замена require(.json) на JSON.parse(fs.readFileSync) для попытки сборки под electron

# 1.3.5
- skipped
# 1.3.4
- **Bug Fix**
  - увеличен таймаут для Windows при определении устройства
- **Internal**
  - добален cross-env и rimraf для кроссплатформенности

# 1.3.0
- **Braking Change**
  - Разделение кода на серверную + CLI и клиентскую части  
- **Internal**
  - Добавление в исходный код Copyright © Nata-Info
  - Корректное удаление и обновление декларативных файлов

# 1.2.3b
- **Bug Fix**
  - не сохранялись декларационные файлы *.d.ts

# 1.2.3a
- **Bug Fix**
  - в реестр осталась старая откомпилированная версия

# 1.2.3
- **Bug Fix**
  - выход по ^C из пинга
  - зависание при отсутствии устройств на ping
 
- **New Feature**
  - при отстутствии ping совсем возвращается не нулевой код
  - при задании --raw в stdout отправляется количество успешных ping-ов

# 1.2.2
- **Bug Fix**
  - исправлена ошибка с запуском в Linux
  
# 1.2.1
- **New Feature**
  - добавлен флаг `--no-term` для команды `download`
  - добавлено свойство `timeout` для `NmsDatagram`
- **Internal**
  - Скрыт вывод стека при ошибке
  - изменены таймауты для операций 
   `InitiateDownloadSeq`, `VerifyDomainChecksum`, `TerminateDownloadSeq`, `ExecuteProgramInv` 
- **Bug Fix**
  - не выводился лог в `production`
- **Documentation**
  - В описании исправлен адрес npm-реестра Ната-Инфо
  

# 1.2.0
- **Breaking Change**
  - change `isResponsible` to `notReply` in `NmsDatagram`
- **New Feature**
  - add command `flash` for flashing minihosts
  - add command `execute` for execute program on device
  - add `execute` in `IDevice`
  - add support multi-version for mib-files
  - change `mib` to `type` property for multi-version devices in `detection.yml`
- **Internal**
  - add <abbr title="Run Type Type Information">RTTI</abbr> and validation to mib file parser
  - change `responce` to `response` and remove `service` type in some mib-files
  
