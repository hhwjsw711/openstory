import z from "zod";

export interface DNADirectorParams {
  prompt: string;
  styleName: string;
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
}

export interface DNAConfig {
  name: string;
  mood: string;
  artStyle: string;
  lighting: string;
  frameRate: string;
  cameraWork: string;
  aspectRatio: string;
  colorGrading: string;
  colorPalette: string[];
  referenceFilms: string[];
}

export interface DNADirectorResponseData {
  message: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DNADirectorResponse {
  status: boolean;
  error?: string;
  data?: DNADirectorResponseData;
}

export interface DNADirectorTemplateMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | { type: string; text: string }
    | { type: string; image_url: { url: string } }
    | Array<
        | { type: string; text: string }
        | { type: string; image_url: { url: string } }
      >;
}

export const DNAConfigSchema = z.object({
  mood: z.string().min(3).max(500),
  artStyle: z.string().min(3).max(500),
  lighting: z.string().min(3).max(500),
  colorPalette: z.array(z.string().min(1)).min(1).max(20),
  cameraWork: z.string().min(3).max(500),
  referenceFilms: z.array(z.string().min(1)).max(50),
  aspectRatio: z.string().regex(/^\d+:\d+$/),
  frameRate: z.string().regex(/^\d+(fps|FPS)$/),
  colorGrading: z.string().min(3).max(300),
});

export type DNAConfigType = z.infer<typeof DNAConfigSchema>;
