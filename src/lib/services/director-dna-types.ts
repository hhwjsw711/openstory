import z from 'zod';

export const DirectorDnaConfigSchema = z.object({
  name: z.string().optional(),
  mood: z.string().min(3).max(500),
  artStyle: z.string().min(3).max(500),
  lighting: z.string().min(3).max(500),
  colorPalette: z.array(z.string().min(1)).min(1).max(20),
  cameraWork: z.string().min(3).max(500),
  referenceFilms: z.array(z.string().min(1)).max(50),
  colorGrading: z.string().min(3).max(300),
  styleName: z.string().optional(),
});

export type DirectorDnaConfig = z.infer<typeof DirectorDnaConfigSchema>;
