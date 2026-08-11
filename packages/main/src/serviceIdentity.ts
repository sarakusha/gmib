const normalizeIdentifier = (identifier: string): string =>
  identifier
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24) || 'unknown';

export const getGmibServiceHostname = (identifier: string): string =>
  `gmib-${normalizeIdentifier(identifier)}.local`;

export const getGmibServiceName = (identifier: string): string =>
  `gmib-${normalizeIdentifier(identifier)}`;

export const getNovastarServiceName = (identifier: string): string =>
  `novastar-${normalizeIdentifier(identifier)}`;
