export type ActivationFormValues = {
  key: string;
  name: string;
};

export const normalizeActivationKey = (value: string): string => value.toUpperCase();

export const normalizeDeviceName = (value?: string): string =>
  (value ?? '').trim().replace(/\.local\.?$/i, '');

export const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

export const isActivationSubmitKey = (key: string): boolean => key === 'Enter' || key === ' ';

export const activationErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return undefined;

  if ('data' in error) {
    const message = activationErrorMessage(error.data);
    if (message) return message;
  }
  if ('message' in error && typeof error.message === 'string') return error.message;
  if ('error' in error && typeof error.error === 'string') return error.error;
  if ('status' in error) return `Ошибка активации (${String(error.status)})`;
  return undefined;
};
