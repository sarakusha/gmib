let hidden = false;

export const isOutputHidden = (): boolean => hidden;

export const setOutputHidden = (value: boolean): boolean => {
  hidden = value;
  return hidden;
};
