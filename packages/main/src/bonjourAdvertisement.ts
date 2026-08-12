export type TxtAdvertisement = {
  activated: boolean;
  published: boolean;
  txt?: Record<string, string>;
  start: CallableFunction;
  stop: CallableFunction;
};

export const updateAdvertisementTxt = (
  advertisement: TxtAdvertisement,
  txt: Record<string, string>,
): void => {
  const currentAdvertisement = advertisement;
  const restart = currentAdvertisement.published || currentAdvertisement.activated;
  currentAdvertisement.txt = txt;
  if (restart)
    currentAdvertisement.stop(() => {
      currentAdvertisement.start();
    });
};
