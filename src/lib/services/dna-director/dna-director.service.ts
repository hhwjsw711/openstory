import {
  callOpenRouter,
  type OpenRouterResponse,
  RECOMMENDED_MODELS,
} from "@/lib/ai/openrouter-client";
import { createServerClient } from "@/lib/supabase/server";
import type {
  DNAConfig,
  DNADirectorParams,
  DNADirectorResponse,
  DNADirectorTemplateMessage,
} from "./types";

export async function DNADirectorProcessor(
  styleId: string,
  prompt: string,
): Promise<DNADirectorResponse> {
  const supabase = createServerClient();
  const { data: style, error: styleError } = await supabase
    .from("styles")
    .select("*")
    .eq("id", styleId)
    .single();

  if (styleError) {
    throw new Error(styleError.message);
  }
  const result: DNADirectorResponse = {
    status: false,
    error: undefined,
    data: undefined,
  };

  if (style?.description && style?.config) {
    const DNAConfig = style.config as unknown as DNAConfig;
    const payload = {
      prompt,
      styleName: style?.name,
      directorialIntent: style?.description,
      mood: DNAConfig.mood,
      visualStyle: DNAConfig.artStyle,
      lighting: DNAConfig.lighting,
      colorPalette: DNAConfig.colorPalette,
      cameraLanguage: DNAConfig?.cameraWork,
      cinematicReferences: DNAConfig?.referenceFilms,
      aspectRatio: DNAConfig.aspectRatio,
      frameLookAndExtras: [DNAConfig?.frameRate, DNAConfig?.colorGrading],
      referenceImageUrl: style?.preview_url,
    };

    let llmResponse: OpenRouterResponse;
    try {
      const directorTemplate = await DNADirectorTemplate(payload);
      llmResponse = await callOpenRouter({
        model: RECOMMENDED_MODELS.creative,
        messages: directorTemplate as DNADirectorTemplateMessage[],
      });

      if (llmResponse?.choices && llmResponse?.choices.length > 0) {
        result.data = {
          message: llmResponse?.choices[0].message.content,
          promptTokens: llmResponse?.usage?.prompt_tokens ?? 0,
          completionTokens: llmResponse?.usage?.completion_tokens ?? 0,
          totalTokens: llmResponse?.usage?.total_tokens ?? 0,
        };
      }

      result.status = true;
    } catch (error) {
      result.error = error as string;
      result.status = false;
    }
  }

  return result;
}

const DNADirectorTemplate = async (params: DNADirectorParams) => {
  const {
    prompt,
    styleName,
    directorialIntent,
    mood,
    visualStyle,
    lighting,
    colorPalette,
    cameraLanguage,
    cinematicReferences,
    aspectRatio,
    frameLookAndExtras,
    referenceImageUrl,
  } = params;

  let messages: DNADirectorTemplateMessage[] = [
    {
      role: "system",
      content: `
        You are a visionary film director.  
        Your role is to transform any story prompt 
        — from a single sentence to a full outline
        — into a ${styleName} screenplay sequence.
        
        🎥 ${styleName} DNA (Always Apply):  
        - Genre Core: ${directorialIntent}
        - Atmosphere: ${mood}
        - Tone: ${visualStyle} ${lighting}
        - Color Palette: ${colorPalette.join(", ")}
        - Inspirations: ${cinematicReferences.join(", ")}

        📷 Cinematography:  
        - Camera: ${cameraLanguage}
        - Frame Rate: ${frameLookAndExtras[0]}
        - Aspect Ratio: ${aspectRatio}
        - Lighting: ${lighting}

        🎭 Storytelling Rules:  
        - Expand minimal prompts into rich, atmospheric scenes.  
        - Present as if shot on film: include scene descriptions, camera cues, and emotional beats.  
        - Balance dialogue with silence, mood, and visual storytelling.  
        - Use pacing, framing, and atmosphere to reveal subtext — not just explicit action.  
        - Prioritize introspection, emotional resonance, and subtle psychology over plot-heavy action.  

        Output Format:  
        - Write in screenplay-inspired style (e.g., INT./EXT. scene headings, atmospheric description, cinematic cues, character beats).  
        - Ensure each scene feels like it belongs in a character-driven, emotionally intense film.  
      `,
    },
  ];

  // If there is a reference image, add it to the messages
  if (referenceImageUrl) {
    const base64Image = await fetch(referenceImageUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => Buffer.from(buffer).toString("base64"));
    messages = [
      ...messages,
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Refer to the sample image as visual inspiration. ${prompt}.`,
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ];
  } else {
    messages = [
      ...messages,
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ];
  }

  return messages;
};
