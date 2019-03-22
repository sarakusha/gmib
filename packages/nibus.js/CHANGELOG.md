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
  
