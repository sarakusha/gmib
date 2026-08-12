export type WindowsMdnsFirewallWarning = {
  address: string;
  commands: string;
};

const quotePowerShell = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export const createWindowsMdnsFirewallCommands = (executablePath: string): string => {
  const path = quotePowerShell(executablePath);
  return `$gmibPath = ${path}
Get-NetFirewallRule -DisplayName 'GMIB mDNS UDP In' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName 'GMIB mDNS UDP Out' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'GMIB mDNS UDP In' -Direction Inbound -Action Allow -Program $gmibPath -Protocol UDP -LocalPort 5353 -RemoteAddress LocalSubnet -Profile Any
New-NetFirewallRule -DisplayName 'GMIB mDNS UDP Out' -Direction Outbound -Action Allow -Program $gmibPath -Protocol UDP -RemotePort 5353 -RemoteAddress 224.0.0.251 -Profile Any`;
};
