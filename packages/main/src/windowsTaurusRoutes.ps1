# Shared by GMIB and the copyable administrator script. No aliases/indices are persisted.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Test-GmibAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-GmibUsbIdentity($adapter) {
    $id = [string]$adapter.PnPDeviceID
    # This is the observed Taurus RK356x USB family, not proof of a Taurus product.
    if ($id -notmatch '^USB\\VID_2207&PID_0013(?:&MI_[0-9A-F]{2})?\\') { return }
    $compatible = @(Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_CompatibleIds' -ErrorAction SilentlyContinue)
    $service = @(Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_Service' -ErrorAction SilentlyContinue)
    $isRndis = @($compatible | ForEach-Object { $_.Data } | Where-Object { $_ -match '^USB\\Class_E0&SubClass_01&Prot_03$' }).Count -gt 0
    $isRndis = $isRndis -or @($service | Where-Object { $_.Data -match '^RNDISMP(6)?$' }).Count -gt 0
    if (-not $isRndis) { return }
    for ($depth = 0; $depth -lt 6; $depth++) {
        # Generated location IDs contain '&'; do not treat them as USB serial numbers.
        if ($id -match '^USB\\VID_2207&PID_0013\\([A-Z0-9_-]{4,64})$') {
            return [pscustomobject]@{ deviceId = $id.ToUpperInvariant(); serialNumber = $Matches[1].ToUpperInvariant() }
        }
        $parent = Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_Parent' -ErrorAction SilentlyContinue
        if (-not $parent -or -not $parent.Data -or $parent.Data -eq $id) { return }
        $id = [string]$parent.Data
    }
}

function Get-GmibTaurusAdapters {
    $routes = @(Get-NetRoute -AddressFamily IPv4 -PolicyStore ActiveStore | Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' })
    foreach ($adapter in @(Get-NetAdapter)) {
        if ($adapter.Status -ne 'Up') { continue }
        $identity = Get-GmibUsbIdentity $adapter
        if (-not $identity) { continue }
        $ip = Get-NetIPInterface -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
        # IPv4 may not have appeared yet, or the USB adapter may have just disconnected.
        if (-not $ip) { continue }
        $dns = Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
        [pscustomobject]@{
            deviceId = $identity.deviceId
            serialNumber = $identity.serialNumber
            interfaceAlias = [string]$adapter.Name
            interfaceIndex = [int]$adapter.ifIndex
            interfaceGuid = [string]$adapter.InterfaceGuid
            defaultRoutes = @($routes | Where-Object { $_.InterfaceIndex -eq $adapter.ifIndex } | ForEach-Object {
                [pscustomobject]@{ nextHop = [string]$_.NextHop; metric = [int]$_.RouteMetric }
            })
            dnsServers = @($dns.ServerAddresses | Where-Object { $_ })
            protection = $(if ($ip.IgnoreDefaultRoutes -eq 'Enabled') { 'enabled' } else { 'missing' })
        }
    }
}

function Get-GmibTaurusStatus {
    $adapters = @(Get-GmibTaurusAdapters)
    try {
        $scheduler = Connect-GmibTaskScheduler
        $folder = $scheduler.GetFolder('\')
        foreach ($adapter in $adapters) {
            try {
                $task = Get-GmibAutomaticTask $folder (Get-GmibTaskName $adapter.deviceId)
                if (-not $task -or (Test-GmibManagedTask $task $adapter.deviceId)) {
                    $adapter | Add-Member -NotePropertyName autoEnabled -NotePropertyValue ([bool]($task -and $task.Enabled))
                }
            } catch { # A task that cannot be read has unknown status.
            }
        }
    } catch { # Task Scheduler may be unavailable; route diagnostics still work.
    }
    [pscustomobject]@{
        supported = $true
        elevated = (Test-GmibAdministrator)
        platform = 'win32'
        adapters = $adapters
    }
}

function Resolve-GmibTaurusAdapter([string]$deviceId) {
    $matches = @(Get-GmibTaurusAdapters | Where-Object { $_.deviceId -eq $deviceId })
    if ($matches.Count -ne 1) { throw 'USB device is missing or ambiguous. Reconnect and check again.' }
    return $matches[0]
}

function Assert-GmibSameAdapter($expected) {
    $current = Resolve-GmibTaurusAdapter $expected.deviceId
    if ($current.interfaceGuid -ne $expected.interfaceGuid -or $current.interfaceIndex -ne $expected.interfaceIndex) {
        throw 'USB adapter changed during the operation. Check again.'
    }
    return $current
}

function Repair-GmibTaurusRoute([string]$deviceId, [switch]$EnsureProtection) {
    if (-not (Test-GmibAdministrator)) { throw 'Run this command in PowerShell as administrator.' }
    $adapter = Resolve-GmibTaurusAdapter $deviceId
    # An old copied command does nothing when the problematic route has already disappeared.
    if (-not $EnsureProtection -and $adapter.defaultRoutes.Count -eq 0) { return }
    $current = Assert-GmibSameAdapter $adapter
    # DHCP address and the connected subnet route remain intact. This is per adapter instance.
    if ($current.protection -ne 'enabled') {
        Set-NetIPInterface -InterfaceIndex $current.interfaceIndex -AddressFamily IPv4 -IgnoreDefaultRoutes Enabled
    }
    $current = Assert-GmibSameAdapter $adapter
    foreach ($route in $current.defaultRoutes) {
        $verified = Assert-GmibSameAdapter $adapter
        $exact = @(Get-NetRoute -InterfaceIndex $verified.interfaceIndex -AddressFamily IPv4 -PolicyStore ActiveStore |
            Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' -and $_.NextHop -eq $route.nextHop })
        foreach ($entry in $exact) {
            $null = Assert-GmibSameAdapter $adapter
            Remove-NetRoute -InputObject $entry -Confirm:$false
        }
    }
    $after = Assert-GmibSameAdapter $adapter
    if ($after.defaultRoutes.Count -gt 0 -or $after.protection -ne 'enabled') {
        throw 'Could not verify the fix. Check the current routes and permissions.'
    }
}

function Invoke-GmibTaurusEventRepair([string]$deviceId) {
    # Boot/network events can precede the adapter and its IPv4 interface.
    for ($retry = 0; $retry -lt 6; $retry++) {
        try {
            $matches = @(Get-GmibTaurusAdapters | Where-Object { $_.deviceId -eq $deviceId })
            if ($matches.Count -eq 1) {
                Repair-GmibTaurusRoute $deviceId -EnsureProtection
                return
            }
        } catch {
            if ($retry -eq 5) { throw }
        }
        if ($retry -lt 5) { Start-Sleep -Seconds 3 }
    }
}

#region Task Scheduler configuration

function Connect-GmibTaskScheduler {
    $scheduler = New-Object -ComObject 'Schedule.Service'
    $scheduler.Connect()
    return $scheduler
}

function Get-GmibTaskName([string]$deviceId) {
    if ($deviceId -notmatch '^USB\\VID_2207&PID_0013\\([A-Z0-9_-]{4,64})\z') { throw 'Invalid Taurus USB identity.' }
    return 'GMIB-Taurus-' + $Matches[1]
}

function Get-GmibTaskDescription([string]$deviceId) {
    return 'GMIB Taurus USB route protection on connection: ' + $deviceId
}

function Get-GmibAutomaticTask($folder, [string]$name) {
    try { return $folder.GetTask($name) }
    catch {
        # COM can wrap the HRESULT in one or more PowerShell exceptions.
        for ($cause = $_.Exception; $cause; $cause = $cause.InnerException) {
            if ($cause.HResult -eq -2147024894) { return } # ERROR_FILE_NOT_FOUND
        }
        throw
    }
}

function Test-GmibManagedTask($task, [string]$deviceId) {
    # OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION. Require a
    # protected SYSTEM-owned DACL and each of the three explicit grants.
    $descriptor = [string]$task.GetSecurityDescriptor(5)
    if ($descriptor -notmatch '^O:(?:SY|S-1-5-18)D:P(?:AI)?((?:\([^()]+\)){3})\z') { return $false }
    $entries = [regex]::Matches($Matches[1], '\([^()]+\)').Value
    return ($entries -match '^\(A;;(?:FA|0x0*1f01ff);;;(?:SY|S-1-5-18)\)$').Count -eq 1 -and
        ($entries -match '^\(A;;(?:FA|0x0*1f01ff);;;(?:BA|S-1-5-32-544)\)$').Count -eq 1 -and
        ($entries -match '^\(A;;(?:FR|0x0*120089);;;(?:BU|S-1-5-32-545)\)$').Count -eq 1 -and
        $task.Definition.RegistrationInfo.Description -ceq (Get-GmibTaskDescription $deviceId)
}

function New-GmibAutomaticTaskXml([string]$deviceId, [string]$encodedCommand) {
    if ($encodedCommand -cnotmatch '^[A-Za-z0-9+/]+={0,2}\z') { throw 'Invalid Taurus task action.' }
    $executable = Join-Path ([Environment]::GetFolderPath('System')) 'WindowsPowerShell\v1.0\powershell.exe'
    $command = [Security.SecurityElement]::Escape($executable)
    $description = [Security.SecurityElement]::Escape((Get-GmibTaskDescription $deviceId))
    $subscription = [Security.SecurityElement]::Escape('<QueryList><Query Id="0" Path="Microsoft-Windows-NetworkProfile/Operational"><Select Path="Microsoft-Windows-NetworkProfile/Operational">*[System[Provider[@Name="Microsoft-Windows-NetworkProfile"] and EventID=10000]]</Select></Query></QueryList>')
    return @"
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>$description</Description></RegistrationInfo>
  <Triggers>
    <BootTrigger><Enabled>true</Enabled></BootTrigger>
    <EventTrigger><Enabled>true</Enabled><Subscription>$subscription</Subscription></EventTrigger>
  </Triggers>
  <Principals><Principal id="System"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <Enabled>false</Enabled>
    <ExecutionTimeLimit>PT45S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="System"><Exec><Command>$command</Command><Arguments>-NoLogo -NoProfile -NonInteractive -EncodedCommand $encodedCommand</Arguments></Exec></Actions>
</Task>
"@
}

function Set-GmibTaurusAutomatic([string]$deviceId, [bool]$enabled, [string]$encodedCommand = '') {
    if (-not (Test-GmibAdministrator)) { throw 'Run this command in PowerShell as administrator.' }
    $name = Get-GmibTaskName $deviceId
    $scheduler = Connect-GmibTaskScheduler
    $folder = $scheduler.GetFolder('\')
    $task = Get-GmibAutomaticTask $folder $name
    if ($task -and -not (Test-GmibManagedTask $task $deviceId)) { throw 'The task name is already in use or the task has unexpected permissions.' }

    if ($enabled) {
        $null = Resolve-GmibTaurusAdapter $deviceId
        if (-not $task) {
            $xml = New-GmibAutomaticTaskXml $deviceId $encodedCommand
            $descriptor = 'O:SYG:SYD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FR;;;BU)'
            # TASK_CREATE | TASK_DONT_ADD_PRINCIPAL_ACE; TASK_LOGON_SERVICE_ACCOUNT.
            # A colliding task is never overwritten, even if created after the lookup.
            $task = $folder.RegisterTask($name, $xml, 18, 'S-1-5-18', $null, 5, $descriptor)
            if (-not (Test-GmibManagedTask $task $deviceId)) { throw 'Could not verify the new task permissions.' }
        }
        $task.Enabled = $true
        $null = $task.Run($null)
    } elseif ($task) {
        $task.Enabled = $false
        $task.Stop(0)
        $folder.DeleteTask($name, 0)
    }
}

#endregion
