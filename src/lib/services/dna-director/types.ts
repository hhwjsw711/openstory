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
