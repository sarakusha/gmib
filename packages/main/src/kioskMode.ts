type KioskEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'GMIB_KIOSK_MODE'>>;

export const isKioskMode = (
  args: readonly string[] = process.argv,
  environment: KioskEnvironment = process.env,
): boolean =>
  args.includes('--kiosk-mode') ||
  environment.GMIB_KIOSK_MODE === '1' ||
  environment.GMIB_KIOSK_MODE === 'true';

export default isKioskMode();
