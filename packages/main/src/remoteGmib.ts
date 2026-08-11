const GMIB_API_PORT = Number(process.env['NIBUS_PORT'] ?? 9001) + 1;
const GMIB_PROBE_TIMEOUT_MS = 2000;

export const probeGmibAddress = async (address: string): Promise<boolean> => {
  try {
    const response = await fetch(`http://${address}:${GMIB_API_PORT}/api/identifier`, {
      signal: AbortSignal.timeout(GMIB_PROBE_TIMEOUT_MS),
    });
    return response.ok && Boolean((await response.text()).trim());
  } catch {
    return false;
  }
};
