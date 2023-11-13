import type { SliderProps } from '@mui/material';
import { Slider } from '@mui/material';
import React from 'react';

const makeConverter =
  (reverse = false) =>
  (values: [number, number]): [number, number] =>
    reverse ? [-values[1], -values[0]] : values;

const Range: React.FC<SliderProps & { reverse?: boolean }> = ({
  reverse = false,
  value: original,
  min: origMin = 0,
  max: origMax = 100,
  onChange,
  ...props
}) => {
  const converter = makeConverter(reverse);
  const value = converter(original as [number, number]);
  const [min, max] = converter([origMin, origMax]);
  return (
    <Slider
      {...props}
      value={value}
      min={min}
      max={max}
      scale={x => (reverse ? -x : x)}
      onChange={(e, v, activeThumb) => onChange?.(e, converter(v as [number, number]), activeThumb)}
    />
  );
};

export default Range;
