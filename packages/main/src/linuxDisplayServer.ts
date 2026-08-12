type LinuxDisplayEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'DISPLAY' | 'WAYLAND_DISPLAY'>>;

export const shouldUseX11 = (
  exactWindowPlacement: boolean,
  platform: NodeJS.Platform = process.platform,
  environment: LinuxDisplayEnvironment = process.env,
): boolean =>
  exactWindowPlacement &&
  platform === 'linux' &&
  Boolean(environment.WAYLAND_DISPLAY && environment.DISPLAY);

export const hasExplicitOzonePlatform = (args: readonly string[] = process.argv): boolean =>
  args.some(arg => arg === '--ozone-platform' || arg.startsWith('--ozone-platform='));
