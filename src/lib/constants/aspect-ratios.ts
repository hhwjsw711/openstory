import { z } from 'zod';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']);

type AspectRatioOption = {
  value: AspectRatio;
  label: string;
  width: number;
  height: number;
};

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '1:1', label: '1:1', width: 1, height: 1 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '3:4', label: '3:4', width: 3, height: 4 },
];

export const getAspectRatioData = (ratio: AspectRatio) => {
  return ASPECT_RATIOS.find((r) => r.value === ratio);
};
