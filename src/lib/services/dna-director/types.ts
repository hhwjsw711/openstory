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
  mood: z
    .string()
    .describe(
      "Emotional atmosphere (e.g., 'Dark and moody', 'Bright and cheerful')",
    ),
  artStyle: z.string().describe("Visual aesthetic style"),
  lighting: z.string().describe("Lighting philosophy and approach"),
  colorPalette: z
    .array(z.string())
    .min(1)
    .describe("Array of color values or descriptions"),
  cameraWork: z.string().describe("Camera movement and framing approach"),
  referenceFilms: z
    .array(z.string())
    .describe("Cinematic influences and references"),
  aspectRatio: z
    .string()
    .regex(/^\d+:\d+$/)
    .describe("Aspect ratio (e.g., '16:9', '2.39:1')"),
  frameRate: z.string().describe("Frame rate specification"),
  colorGrading: z.string().describe("Color grading approach"),
});

export type DNAConfigType = z.infer<typeof DNAConfigSchema>;
