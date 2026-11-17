param([string]$Source, [string]$Scenario, [string]$AutomaticScript)
. $Source
$script:writes = [Collections.Generic.List[string]]::new()
$script:adapter = [pscustomobject]@{ PnPDeviceID = 'USB\VID_2207&PID_0013&MI_00\CHILD'; Status = 'Up'; Name = 'Ethernet 47'; ifIndex = 47; InterfaceGuid = 'new-guid' }
$script:protected = $false
$script:sleeps = 0
$script:routes = @(
    [pscustomobject]@{ InterfaceIndex = 47; DestinationPrefix = '0.0.0.0/0'; NextHop = '192.169.110.254'; RouteMetric = 100 },
    [pscustomobject]@{ InterfaceIndex = 7; DestinationPrefix = '0.0.0.0/0'; NextHop = '192.168.0.1'; RouteMetric = 10 },
    [pscustomobject]@{ InterfaceIndex = 47; DestinationPrefix = '192.169.110.0/24'; NextHop = '0.0.0.0'; RouteMetric = 256 }
)
function Test-GmibAdministrator { return $Scenario -ne 'no-admin' }
function Get-NetAdapter { if ($Scenario -notin @('disconnected', 'event-disconnected')) { $script:adapter }; if ($Scenario -eq 'ambiguous') { $script:adapter } }
function Get-PnpDeviceProperty($InstanceId, $KeyName, $ErrorAction) {
    if ($KeyName -eq 'DEVPKEY_Device_CompatibleIds') { return [pscustomobject]@{ Data = @('USB\Class_E0&SubClass_01&Prot_03') } }
    if ($KeyName -eq 'DEVPKEY_Device_Parent') { return [pscustomobject]@{ Data = 'USB\VID_2207&PID_0013\26707A000004040' } }
}
function Get-NetIPInterface($InterfaceIndex, $AddressFamily) {
    if ($Scenario -eq 'event-delayed' -and $script:sleeps -lt 2) { return }
    return [pscustomobject]@{ IgnoreDefaultRoutes = $(if ($script:protected) { 'Enabled' } else { 'Disabled' }) }
}
function Start-Sleep($Seconds) { if ($Seconds -ne 3) { throw 'Unexpected event retry interval' }; $script:sleeps++ }
function Get-DnsClientServerAddress($InterfaceIndex, $AddressFamily) { return [pscustomobject]@{ ServerAddresses = @('192.169.110.254') } }
function Get-NetRoute($AddressFamily, $PolicyStore, $InterfaceIndex) {
    if ($InterfaceIndex -and $Scenario -eq 'replug-during-route-query') { $script:adapter.InterfaceGuid = 'replacement' }
    if ($InterfaceIndex) { $script:routes | Where-Object { $_.InterfaceIndex -eq $InterfaceIndex } }
    else { $script:routes }
}
$script:task = $null
$script:registration = $null
$deviceId = 'USB\VID_2207&PID_0013\26707A000004040'
$name = 'GMIB-Taurus-26707A000004040'
$description = 'GMIB Taurus USB route protection on connection: ' + $deviceId
$acl = 'O:SYD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FR;;;BU)'

function New-MockTask([string]$Description, [string]$Acl, [bool]$Enabled) {
    $task = [pscustomobject]@{
        Definition = [pscustomobject]@{ RegistrationInfo = [pscustomobject]@{ Description = $Description } }
        active = $Enabled
        acl = $Acl
    }
    $task | Add-Member ScriptMethod GetSecurityDescriptor {
        param($Information)
        if ($Information -ne 5) { throw 'Incorrect descriptor query' }
        return $this.acl
    }
    $task | Add-Member ScriptProperty Enabled { $this.active } {
        param($Enabled)
        $script:writes.Add("enabled:$Enabled")
        $this.active = $Enabled
    }
    $task | Add-Member ScriptMethod Run { param($Parameters); $script:writes.Add('run-task') }
    $task | Add-Member ScriptMethod Stop { param($Flags); $script:writes.Add('stop-task') }
    return $task
}

if ($Scenario -eq 'disable-auto') { $script:task = New-MockTask $description $acl $true }
if ($Scenario -eq 'collision-description') { $script:task = New-MockTask 'Another task' $acl $true }
if ($Scenario -eq 'collision-owner') { $script:task = New-MockTask $description ($acl.Replace('O:SY', 'O:BU')) $true }
if ($Scenario -eq 'collision-dacl') { $script:task = New-MockTask $description ($acl.Replace('FR;;;BU', 'FA;;;BU')) $true }

$script:folder = [pscustomobject]@{}
$script:folder | Add-Member ScriptMethod GetTask {
    param($Name)
    if ($Name -ne 'GMIB-Taurus-26707A000004040') { throw 'Unexpected task name' }
    if ($Scenario -eq 'cannot-read-task') { throw [Runtime.InteropServices.COMException]::new('Access denied', -2147024891) }
    if (-not $script:task) { throw [Runtime.InteropServices.COMException]::new('Task absent', -2147024894) }
    return $script:task
}
$script:folder | Add-Member ScriptMethod RegisterTask {
    param($Name, $Definition, $Flags, $User, $Password, $Logon, $Sddl)
    $script:registration = [pscustomobject]@{ name = $Name; xml = $Definition; flags = $Flags; user = $User; logon = $Logon; sddl = $Sddl }
    if ($Scenario -eq 'collision-during-registration') { throw 'Task already exists' }
    $taskXml = [xml]$Definition
    $taskAcl = $Sddl.Replace('G:SY', '')
    if ($Scenario -eq 'unexpected-new-acl') { $taskAcl = $taskAcl.Replace('FR;;;BU', 'FA;;;BU') }
    $script:task = New-MockTask $taskXml.Task.RegistrationInfo.Description $taskAcl ($taskXml.Task.Settings.Enabled -eq 'true')
    $script:writes.Add('register-task')
    return $script:task
}
$script:folder | Add-Member ScriptMethod DeleteTask {
    param($Name, $Flags)
    $script:writes.Add('delete-task')
    $script:task = $null
}
function New-Object($ComObject) {
    if ($ComObject -ne 'Schedule.Service') { throw 'Unexpected COM object' }
    $scheduler = [pscustomobject]@{}
    $scheduler | Add-Member ScriptMethod Connect {}
    $scheduler | Add-Member ScriptMethod GetFolder { param($Path); if ($Path -ne '\') { throw 'Unexpected task folder' }; return $script:folder }
    return $scheduler
}
if ($AutomaticScript) { function Join-Path($Path, $ChildPath) { return 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' } }
function Set-NetIPInterface($InterfaceIndex, $AddressFamily, $IgnoreDefaultRoutes) {
    $script:writes.Add("protect:$InterfaceIndex")
    if ($Scenario -eq 'permission-error') { throw 'Access denied' }
    $script:protected = $true
    if ($Scenario -eq 'replug-during-repair') { $script:adapter.InterfaceGuid = 'replacement'; $script:adapter.ifIndex = 48 }
}
function Remove-NetRoute($InputObject, $Confirm) {
    $script:writes.Add("remove:$($InputObject.InterfaceIndex):$($InputObject.DestinationPrefix)")
    if ($Scenario -ne 'route-persists') { $script:routes = @($script:routes | Where-Object { $_ -ne $InputObject }) }
}
if ($Scenario -in @('no-default', 'event-delayed')) { $script:routes = @($script:routes | Where-Object { $_.InterfaceIndex -ne 47 -or $_.DestinationPrefix -ne '0.0.0.0/0' }) }
if ($Scenario -eq 'unrelated-usb') { $script:adapter.PnPDeviceID = 'USB\VID_1234&PID_5678\OTHER' }
if ($Scenario -eq 'location-id') {
    function Get-PnpDeviceProperty($InstanceId, $KeyName, $ErrorAction) {
        if ($KeyName -eq 'DEVPKEY_Device_CompatibleIds') { return [pscustomobject]@{ Data = @('USB\Class_E0&SubClass_01&Prot_03') } }
        if ($KeyName -eq 'DEVPKEY_Device_Parent') { return [pscustomobject]@{ Data = 'USB\VID_2207&PID_0013\6&generated&0' } }
    }
}
$failure = $null
try {
    if ($AutomaticScript) {
        $sourceText = [IO.File]::ReadAllText($Source)
        $generated = [IO.File]::ReadAllText($AutomaticScript)
        if (-not $generated.StartsWith($sourceText)) {
            $sourceText = ($sourceText -split '\r?\n#region Task Scheduler configuration\r?\n', 2)[0]
            if (-not $generated.StartsWith($sourceText)) { throw 'Unexpected script prefix' }
        }
        # The shared functions above are already sourced with the mock dependencies.
        & ([scriptblock]::Create($generated.Substring($sourceText.Length))) | Out-Null
    } else { Repair-GmibTaurusRoute $deviceId }
} catch { $failure = $_.Exception.Message }
[pscustomobject]@{ writes = @($script:writes.ToArray()); failure = $failure; routes = @($script:routes); status = (Get-GmibTaurusStatus); registration = $script:registration; sleeps = $script:sleeps } | ConvertTo-Json -Depth 8 -Compress
