import {
  callOpenRouter,
  type OpenRouterMessage,
  type OpenRouterResponse,
  RECOMMENDED_MODELS,
} from "@/lib/ai/openrouter-client";
import { createServerClient } from "@/lib/supabase/server";
import {
  DNAConfigSchema,
  type DNADirectorParams,
  type DNADirectorResponse,
  type DNADirectorTemplateMessage,
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

  const result: DNADirectorResponse = {
    status: false,
    error: undefined,
    data: undefined,
  };

  if (styleError) {
    result.error = styleError.message;
    result.status = false;
    return result;
  }

  if (!style) {
    result.error = "Style not found";
    return result;
  }

  if (!style.description) {
    result.error = "Style missing description";
    return result;
  }

  if (!style.config) {
    result.error = "Style missing config";
    return result;
  }

  const parsedConfig = DNAConfigSchema.safeParse(style.config);
  if (!parsedConfig.success) {
    result.error = "Invalid style config";
    result.status = false;
    return result;
  }

  const DNAConfig = parsedConfig.data;
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
    frameLookAndExtras: [
      DNAConfig.frameRate ?? "24fps",
      DNAConfig.colorGrading ?? "Natural",
    ].filter(Boolean),
    referenceImageUrl: null,
  };

  let llmResponse: OpenRouterResponse | undefined;
  try {
    const directorTemplate = await DNADirectorTemplate(payload);
    llmResponse = await callOpenRouter({
      model: RECOMMENDED_MODELS.creative,
      messages: directorTemplate as OpenRouterMessage[],
    });

    if (llmResponse?.choices && llmResponse?.choices.length > 0) {
      const content = llmResponse.choices[0].message.content;
      const messageText =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? ((content as Array<{ type: string; text?: string }>).find(
                (c) => c.type === "text",
              )?.text ?? "")
            : typeof content === "object" &&
                content !== null &&
                "type" in content &&
                (content as { type: string }).type === "text"
              ? ((content as { text?: string }).text ?? "")
              : "";

      if (messageText && messageText.trim().length > 0) {
        result.data = {
          message: messageText,
          promptTokens: llmResponse?.usage?.prompt_tokens ?? 0,
          completionTokens: llmResponse?.usage?.completion_tokens ?? 0,
          totalTokens: llmResponse?.usage?.total_tokens ?? 0,
        };
        result.status = true;
      } else {
        result.error = "Empty response from LLM";
        result.status = false;
      }
    } else {
      result.error = "Empty response from LLM";
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.status = false;
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
        You are a CINEMATOGRAPHER and VISUAL TRANSLATOR, NOT a creative writer.
        
        CRITICAL RULES (DO NOT VIOLATE):
        1. DO NOT invent new plot points, characters, or story beats
        2. DO NOT change what happens in the scene
        3. DO NOT add dialogue unless it already exists in the input
        4. ONLY add visual/cinematic descriptions to what's already there
        
        YOUR ONLY JOB:
        - Take the exact story content provided
        - Add camera angles, lighting, and visual descriptions
        - Apply ${styleName} style through HOW you describe it, not WHAT happens
        
        🎥 ${styleName} STYLE DNA (Infuse Throughout):
        - Directorial Vision: ${directorialIntent}
        - Emotional Atmosphere: ${mood}
        - Visual Aesthetic: ${visualStyle}
        - Lighting Philosophy: ${lighting}
        - Color Narrative: ${colorPalette.join(", ")}
        - Cinematic Influences: ${cinematicReferences.join(", ")}

        📷 CINEMATOGRAPHY LANGUAGE (Integrate Naturally):
        - Camera Movement & Framing: ${cameraLanguage}
        - Technical Specs: ${frameLookAndExtras[0]}, ${aspectRatio}
        - Light & Shadow: ${lighting}

        🎬 WHAT YOU CAN ADD (Visual Layer Only):
        
        CAMERA WORK:
        - Shot types: WIDE, MEDIUM, CLOSE-UP, TRACKING, etc.
        - Camera movement: dolly, pan, tilt, steadicam, handheld
        - Angles: high angle, low angle, Dutch angle, POV
        
        LIGHTING & COLOR:
        - Light sources: natural, practical, motivated
        - Quality: hard, soft, diffused, directional
        - Color temperature: warm tungsten, cool daylight, mixed
        - Apply ${styleName} color palette: ${colorPalette.join(", ")}
        
        ATMOSPHERE ONLY:
        - Environmental sounds that enhance existing scene
        - Weather/time of day details if not specified
        - Textures and surfaces visible in frame
        - Ambient background life that doesn't distract
        
        🚫 WHAT YOU CANNOT CHANGE:
        - Story events (if character walks in, they walk in - don't change to running)
        - Character actions (if they pick up a cup, don't change it to a phone)
        - Dialogue or conversations
        - Character emotions (angry stays angry, happy stays happy)
        - Scene location or setting
        - Sequence of events

        OUTPUT FORMAT:
        - Start with scene heading from input (or add if missing): INT./EXT. LOCATION - TIME
        - Use UPPERCASE for camera directions: WIDE ON, CLOSE UP, TRACKING SHOT
        - Wrap visual descriptions in parentheses after the action
        - Keep every word of dialogue and action from the input
        - Add camera/lighting notes AROUND the existing content, never replacing it
        
        EXAMPLE TRANSFORMATION:
        INPUT: "Sarah enters the room. She's angry. 'Where were you?' she asks."
        
        ✅ CORRECT OUTPUT:
        INT. LIVING ROOM - NIGHT
        
        WIDE ON the doorway as Sarah enters, backlit by harsh hallway fluorescents.
        (${styleName} low-angle shot emphasizes her silhouette)
        
        She's angry. Her jaw clenched, fists tight.
        (Close-up, shallow depth of field, warm practicals in background)
        
        SARAH
        Where were you?
        (Two-shot, static frame, tension in the silence after)
        
        ❌ WRONG - DO NOT DO THIS:
        "Sarah storms into the dimly lit room, her eyes blazing with fury. She slams the door and screams, 'I can't believe you!'"
        (This changed her action from "enters" to "storms", added door slam, changed dialogue)
        
        CRITICAL: If the input says a character "walks", don't change it to "strides" or "moves purposefully". Keep the EXACT verbs and actions. Only add the visual HOW, never change the WHAT.
        
        Output ONLY the enhanced scene. No explanations before or after.
      `,
    },
  ];

  // Validate URL
  let imgUrl: string | null = referenceImageUrl;
  try {
    const url = new URL(referenceImageUrl || "");
    if (!["http:", "https:"].includes(url.protocol)) {
      console.warn(
        "[DNADirector] Invalid protocol in reference URL, ignoring image",
      );
      imgUrl = null; // Fall back to no image
    }
  } catch {
    console.warn("[DNADirector] Invalid reference image URL, ignoring image");
    imgUrl = null; // Fall back to no image
  }

  // If there is a reference image, add it to the messages
  if (imgUrl) {
    // Fetch with size limit and timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch(imgUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Velro/1.0" },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType?.startsWith("image/")) {
        throw new Error("URL does not point to an image");
      }

      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
        // 10MB limit
        throw new Error("Image too large");
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 10 * 1024 * 1024) {
        throw new Error("Image too large");
      }
      const mimeType = contentType || "image/jpeg";
      const base64Image = Buffer.from(buffer).toString("base64");

      messages = [
        ...messages,
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Add ONLY cinematic descriptions (camera, lighting, atmosphere) to this scene. DO NOT change any story events, dialogue, or actions.
  
  ORIGINAL SCENE TO ENHANCE:
  ${prompt}
  
  Reference image for visual style:`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: "text",
              text: `Remember: Keep ALL story content identical. Only add visual/cinematic layer.`,
            },
          ],
        },
      ];
    } catch (fetchError) {
      console.warn(
        "[DNADirector] Failed to fetch reference image:",
        fetchError,
      );
    } finally {
      clearTimeout(timeout);
    }
  } else {
    messages = [
      ...messages,
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Add ONLY cinematic descriptions (camera, lighting, atmosphere) to this scene. DO NOT change any story events, dialogue, or actions.

ORIGINAL SCENE TO ENHANCE:
${prompt}

Remember: Keep ALL story content identical. Only add visual/cinematic layer.`,
          },
        ],
      },
    ];
  }

  return messages;
};
