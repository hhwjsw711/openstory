import z from 'zod';

export type DirectorDnaParams = {
  prompt: string;
  directorialIntent: string;
  mood: string;
  visualStyle: string;
  lighting: string;
  colorPalette: string[];
  cameraLanguage: string;
  cinematicReferences: string[];
  aspectRatio: string;
  frameLookAndExtras: string[];
  referenceImageUrl: string | null;
  styleCategory: string;
};

export const DirectorDnaConfigSchema = z.object({
  name: z.string().optional(),
  mood: z.string().min(3).max(500),
  artStyle: z.string().min(3).max(500),
  lighting: z.string().min(3).max(500),
  colorPalette: z.array(z.string().min(1)).min(1).max(20),
  cameraWork: z.string().min(3).max(500),
  referenceFilms: z.array(z.string().min(1)).max(50),
  aspectRatio: z.string().regex(/^\d+(\.\d+)?:\d+(\.\d+)?$/), // 16:9, 4:3, 1:1, 23.5:1, etc.
  frameRate: z.string().regex(/^\d+(fps|FPS)$/),
  colorGrading: z.string().min(3).max(300),
  styleName: z.string().optional(),
});

export type DirectorDnaConfig = z.infer<typeof DirectorDnaConfigSchema>;

export type DirectorDnaResponseData = {
  message: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export interface DNADirectorResponse {
  status: boolean;
  error?: string;
  data?: DirectorDnaResponseData;
  config?: Record<string, unknown>;
}

export interface DNADirectorTemplateMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | { type: string; text: string }
    | { type: string; image_url: { url: string } }
    | Array<
        | { type: string; text: string }
        | { type: string; image_url: { url: string } }
      >;
}

export interface DNADirectorTemplateMessageContent {
  scene: string;
  directorialIntent: string;
  characters: string[];
  styleConfig: DirectorDnaConfig;
}
