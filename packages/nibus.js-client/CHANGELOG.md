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
# 1.3.4
- **Internal**
  - удален повторяющийся MibDescription
- **Bug Fix**
  - исправлен метод NmsDatagram.isResponseFor, теперь точное соответствие отпраленного и принятого ответа.
  Раньше могло привести к таймауту при двух запросах version, один на ::0 и второй на цель
  - изменен алгоритм определения устройства на Windows
# 1.3.3
- **Internal**
  - device.readAll отсоритрован по nms_id
# 1.3.2
- **Bug Fix**
  - Контроль min, max для числовых типов на основании базового типа
- **Internal**
  - При повторном вызове readAll, если предыдущий вызов еще не завершен, выполнится
  только первый, последующие получат результат первого

# 1.3.1
- **Bug Fix**
  - session.start всегда возвращает количество доступных портов
