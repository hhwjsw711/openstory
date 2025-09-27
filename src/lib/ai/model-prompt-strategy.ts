/**
 * Model-specific prompt engineering strategies
 * Optimizes prompts for each FAL model's specific capabilities
 */

export interface PromptStrategy {
  prefix: string;
  suffix: string;
  style: string;
  quality: "fast" | "balanced" | "high" | "ultra";
  textProcessing?: {
    enhanceKeywords?: boolean;
    addTechnicalTerms?: boolean;
    improveStructure?: boolean;
    maxLength?: number;
  };
  contextAware?: boolean;
  styleAdaptation?: {
    supportsComplexStyles?: boolean;
    requiresSimplification?: boolean;
    optimalComplexity?: "simple" | "moderate" | "complex";
  };
}

export interface TextAnalysis {
  hasCharacters: boolean;
  hasAction: boolean;
  hasSetting: boolean;
  hasEmotion: boolean;
  hasTechnicalTerms: boolean;
  hasProperNouns: boolean;
  properNouns: string[];
  wordCount: number;
  complexity: "simple" | "moderate" | "complex";
}

export const MODEL_PROMPT_STRATEGIES: Record<string, PromptStrategy> = {
  flux_pro: {
    prefix: "cinematic, high quality, detailed, ",
    suffix:
      ", professional photography, 8k resolution, sharp focus, masterful composition",
    style: "photorealistic",
    quality: "high",
    textProcessing: {
      enhanceKeywords: true,
      addTechnicalTerms: true,
      improveStructure: true,
      maxLength: 5000,
    },
    contextAware: true,
    styleAdaptation: {
      supportsComplexStyles: true,
      requiresSimplification: false,
      optimalComplexity: "complex",
    },
  },
  flux_dev: {
    prefix: "artistic, creative, ",
    suffix:
      ", digital art, vibrant colors, dynamic composition, expressive style",
    style: "artistic",
    quality: "balanced",
    textProcessing: {
      enhanceKeywords: true,
      addTechnicalTerms: false,
      improveStructure: true,
      maxLength: 5000,
    },
    contextAware: true,
    styleAdaptation: {
      supportsComplexStyles: true,
      requiresSimplification: false,
      optimalComplexity: "moderate",
    },
  },
  flux_schnell: {
    prefix: "simple, clean, ",
    suffix: ", minimal style, clear composition, efficient rendering",
    style: "minimal",
    quality: "fast",
    textProcessing: {
      enhanceKeywords: false,
      addTechnicalTerms: false,
      improveStructure: false,
      maxLength: 5000,
    },
    contextAware: false,
    styleAdaptation: {
      supportsComplexStyles: false,
      requiresSimplification: true,
      optimalComplexity: "simple",
    },
  },
  flux_pro_kontext_max: {
    prefix: "contextual, scene-aware, ",
    suffix:
      ", consistent with reference, seamless integration, contextual harmony",
    style: "contextual",
    quality: "high",
    textProcessing: {
      enhanceKeywords: true,
      addTechnicalTerms: true,
      improveStructure: true,
      maxLength: 5000,
    },
    contextAware: true,
    styleAdaptation: {
      supportsComplexStyles: true,
      requiresSimplification: false,
      optimalComplexity: "complex",
    },
  },
  imagen4_preview_ultra: {
    prefix: "ultra-realistic, photorealistic, ",
    suffix:
      ", professional grade, studio quality, perfect lighting, ultra-detailed",
    style: "ultra-realistic",
    quality: "ultra",
    textProcessing: {
      enhanceKeywords: true,
      addTechnicalTerms: true,
      improveStructure: true,
      maxLength: 5000,
    },
    contextAware: true,
    styleAdaptation: {
      supportsComplexStyles: true,
      requiresSimplification: false,
      optimalComplexity: "complex",
    },
  },
  flux_krea_lora: {
    prefix: "artistic, stylized, ",
    suffix: ", creative interpretation, unique style, artistic flair",
    style: "stylized",
    quality: "balanced",
    textProcessing: {
      enhanceKeywords: true,
      addTechnicalTerms: false,
      improveStructure: true,
      maxLength: 5000,
    },
    contextAware: true,
    styleAdaptation: {
      supportsComplexStyles: true,
      requiresSimplification: false,
      optimalComplexity: "moderate",
    },
  },
  sdxl: {
    prefix: "high quality, detailed, ",
    suffix: ", professional, well-composed, sharp details",
    style: "photorealistic",
    quality: "balanced",
    textProcessing: {
      enhanceKeywords: true,
      addTechnicalTerms: true,
      improveStructure: true,
      maxLength: 5000,
    },
    contextAware: true,
    styleAdaptation: {
      supportsComplexStyles: true,
      requiresSimplification: false,
      optimalComplexity: "moderate",
    },
  },
  sdxl_lightning: {
    prefix: "dynamic, energetic, ",
    suffix: ", fast-paced, vibrant, high contrast",
    style: "dynamic",
    quality: "fast",
    textProcessing: {
      enhanceKeywords: false,
      addTechnicalTerms: false,
      improveStructure: false,
      maxLength: 5000,
    },
    contextAware: false,
    styleAdaptation: {
      supportsComplexStyles: false,
      requiresSimplification: true,
      optimalComplexity: "simple",
    },
  },
};

/**
 * Analyzes input text to understand its structure and content
 */
export function analyzeText(inputText: string): TextAnalysis {
  const words = inputText.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  // Character detection patterns
  const characterPatterns = [
    /\b(man|woman|person|character|actor|actress|protagonist|hero|heroine)\b/,
    /\b(he|she|they|him|her|them)\b/,
    /\b(mr|mrs|ms|dr|professor|captain|officer)\b/,
  ];

  // Action detection patterns
  const actionPatterns = [
    /\b(run|walk|jump|fly|drive|swim|climb|fall|rise|move|go|come)\b/,
    /\b(look|see|watch|observe|stare|glance|gaze)\b/,
    /\b(speak|say|tell|talk|whisper|shout|yell|scream)\b/,
    /\b(hold|grab|catch|throw|push|pull|lift|carry)\b/,
  ];

  // Setting detection patterns
  const settingPatterns = [
    /\b(room|house|building|street|park|forest|mountain|ocean|city|town)\b/,
    /\b(indoor|outdoor|inside|outside|interior|exterior)\b/,
    /\b(day|night|morning|evening|sunset|sunrise|dawn|dusk)\b/,
    /\b(weather|rain|snow|sun|cloud|wind|storm)\b/,
  ];

  // Emotion detection patterns
  const emotionPatterns = [
    /\b(happy|sad|angry|excited|scared|surprised|confused|worried|calm|peaceful)\b/,
    /\b(smile|frown|laugh|cry|scream|shout|whisper)\b/,
    /\b(joy|sorrow|fear|anger|love|hate|hope|despair)\b/,
  ];

  // Technical terms detection
  const technicalPatterns = [
    /\b(camera|shot|angle|frame|scene|sequence|cut|edit|zoom|pan|tilt)\b/,
    /\b(lighting|shadow|contrast|exposure|focus|depth|field)\b/,
    /\b(composition|rule|thirds|symmetry|balance|rhythm)\b/,
  ];

  // Proper noun detection patterns
  const properNounPatterns = [
    // Names (capitalized words that could be names)
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // First Last names
    /\b[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+\b/g, // First M. Last names
    /\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+\b/g, // Three word names

    // Places
    /\b[A-Z][a-z]+ (Street|Avenue|Road|Boulevard|Drive|Lane|Way|Place|Court)\b/g,
    /\b[A-Z][a-z]+ (City|Town|Village|County|State|Country|Nation|Kingdom|Republic)\b/g,
    /\b[A-Z][a-z]+ (Mountain|Hill|Valley|River|Lake|Ocean|Sea|Bay|Gulf|Island)\b/g,
    /\b[A-Z][a-z]+ (Park|Garden|Plaza|Square|Center|Mall|Building|Tower|Bridge)\b/g,

    // Brands and companies
    /\b[A-Z][a-z]+ (Inc|Corp|LLC|Ltd|Company|Corporation|Enterprises|Group|Systems)\b/g,
    /\b[A-Z][a-z]+ (Restaurant|Cafe|Hotel|Motel|Inn|Bar|Club|Studio|Gallery|Museum)\b/g,

    // Titles and organizations
    /\b[A-Z][a-z]+ (University|College|School|Academy|Institute|Foundation|Society|Club|Association)\b/g,
    /\b[A-Z][a-z]+ (Hospital|Clinic|Medical|Center|Laboratory|Research|Development)\b/g,

    // Common proper nouns
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g,
    /\b(Christmas|Easter|Halloween|Thanksgiving|New Year|Valentine|Independence Day)\b/g,

    // Geographic locations
    /\b(New York|Los Angeles|San Francisco|Las Vegas|Miami|Chicago|Boston|Seattle|Portland|Denver)\b/g,
    /\b(United States|United Kingdom|Canada|Australia|Germany|France|Italy|Spain|Japan|China)\b/g,

    // Famous landmarks
    /\b(Eiffel Tower|Statue of Liberty|Golden Gate Bridge|Empire State Building|White House|Big Ben|Taj Mahal)\b/g,

    // Movies, books, games
    /\b[A-Z][a-z]+: [A-Z][a-z]+\b/g, // Title: Subtitle format
    /\b"[A-Z][a-z]+ [A-Z][a-z]+"\b/g, // Quoted titles
    /\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+\b/g, // Four word titles
  ];

  const hasCharacters = characterPatterns.some((pattern) =>
    pattern.test(inputText),
  );
  const hasAction = actionPatterns.some((pattern) => pattern.test(inputText));
  const hasSetting = settingPatterns.some((pattern) => pattern.test(inputText));
  const hasEmotion = emotionPatterns.some((pattern) => pattern.test(inputText));
  const hasTechnicalTerms = technicalPatterns.some((pattern) =>
    pattern.test(inputText),
  );

  // Extract proper nouns
  const properNouns: string[] = [];
  properNounPatterns.forEach((pattern) => {
    const matches = inputText.match(pattern);
    if (matches) {
      properNouns.push(...matches);
    }
  });

  // Remove duplicates and filter out common false positives
  const uniqueProperNouns = [...new Set(properNouns)].filter((noun) => {
    const lowerNoun = noun.toLowerCase();
    // Filter out common words that might be capitalized but aren't proper nouns
    const commonWords = [
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "up",
      "about",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
      "among",
      "under",
      "over",
      "around",
      "near",
      "far",
      "here",
      "there",
      "where",
      "when",
      "why",
      "how",
      "what",
      "who",
      "which",
      "that",
      "this",
      "these",
      "those",
      "some",
      "any",
      "all",
      "both",
      "each",
      "every",
      "few",
      "many",
      "most",
      "other",
      "several",
      "such",
      "no",
      "nor",
      "not",
      "only",
      "own",
      "same",
      "so",
      "than",
      "too",
      "very",
      "can",
      "will",
      "just",
      "should",
      "now",
    ];
    return !commonWords.includes(lowerNoun) && noun.length > 2;
  });

  const hasProperNouns = uniqueProperNouns.length > 0;

  // Determine complexity based on word count and content richness
  let complexity: "simple" | "moderate" | "complex" = "simple";
  if (
    wordCount > 20 ||
    (hasCharacters && hasAction && hasSetting) ||
    hasProperNouns
  ) {
    complexity = "complex";
  } else if (wordCount > 10 || (hasCharacters && (hasAction || hasSetting))) {
    complexity = "moderate";
  }

  return {
    hasCharacters,
    hasAction,
    hasSetting,
    hasEmotion,
    hasTechnicalTerms,
    hasProperNouns,
    properNouns: uniqueProperNouns,
    wordCount,
    complexity,
  };
}

/**
 * Enhances keywords in the text based on analysis
 */
export function enhanceKeywords(text: string, analysis: TextAnalysis): string {
  let enhanced = text;

  // Preserve proper nouns - don't modify them
  const properNounPlaceholders: { [key: string]: string } = {};
  analysis.properNouns.forEach((noun, index) => {
    const placeholder = `__PROPER_NOUN_${index}__`;
    properNounPlaceholders[placeholder] = noun;
    enhanced = enhanced.replace(
      new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
      placeholder,
    );
  });

  // Add descriptive adjectives for characters
  if (analysis.hasCharacters) {
    enhanced = enhanced.replace(/\b(man|woman|person)\b/g, (match) => {
      const descriptors = [
        "distinguished",
        "elegant",
        "mysterious",
        "charismatic",
        "striking",
      ];
      const randomDescriptor =
        descriptors[Math.floor(Math.random() * descriptors.length)];
      return `${randomDescriptor} ${match}`;
    });
  }

  // Enhance action words
  if (analysis.hasAction) {
    enhanced = enhanced.replace(/\b(walk|run|move)\b/g, (match) => {
      const enhancements = {
        walk: "gracefully walk",
        run: "swiftly run",
        move: "deliberately move",
      };
      return enhancements[match as keyof typeof enhancements] || match;
    });
  }

  // Add atmospheric details for settings
  if (analysis.hasSetting && !analysis.hasTechnicalTerms) {
    enhanced = enhanced.replace(/\b(room|space|area)\b/g, "atmospheric room");
  }

  // Add context for proper nouns
  if (analysis.hasProperNouns) {
    // Add descriptive context for locations
    enhanced = enhanced.replace(
      /\b(Street|Avenue|Road|Boulevard|Drive|Lane|Way|Place|Court)\b/g,
      "picturesque $1",
    );
    enhanced = enhanced.replace(
      /\b(City|Town|Village|County|State|Country)\b/g,
      "historic $1",
    );
    enhanced = enhanced.replace(
      /\b(Mountain|Hill|Valley|River|Lake|Ocean|Sea|Bay|Gulf|Island)\b/g,
      "majestic $1",
    );
    enhanced = enhanced.replace(
      /\b(Park|Garden|Plaza|Square|Center|Mall|Building|Tower|Bridge)\b/g,
      "iconic $1",
    );
  }

  // Restore proper nouns
  Object.entries(properNounPlaceholders).forEach(([placeholder, noun]) => {
    enhanced = enhanced.replace(new RegExp(placeholder, "g"), noun);
  });

  return enhanced;
}

/**
 * Adds technical photography/cinematography terms
 */
export function addTechnicalTerms(
  text: string,
  analysis: TextAnalysis,
): string {
  if (analysis.hasTechnicalTerms) {
    return text; // Already has technical terms
  }

  let enhanced = text;

  // Add camera angles for action scenes
  if (analysis.hasAction) {
    enhanced += ", dynamic camera angle";
  }

  // Add lighting for character scenes
  if (analysis.hasCharacters) {
    enhanced += ", dramatic lighting";
  }

  // Add composition for setting scenes
  if (analysis.hasSetting) {
    enhanced += ", well-composed frame";
  }

  // Add specific technical terms for proper noun locations
  if (analysis.hasProperNouns) {
    const hasLocationNouns = analysis.properNouns.some((noun) =>
      /\b(Street|Avenue|Road|Boulevard|Drive|Lane|Way|Place|Court|City|Town|Village|County|State|Country|Mountain|Hill|Valley|River|Lake|Ocean|Sea|Bay|Gulf|Island|Park|Garden|Plaza|Square|Center|Mall|Building|Tower|Bridge)\b/.test(
        noun,
      ),
    );

    if (hasLocationNouns) {
      enhanced += ", establishing shot, wide angle view";
    }
  }

  return enhanced;
}

/**
 * Improves text structure and flow
 */
export function improveStructure(text: string, analysis: TextAnalysis): string {
  let improved = text;

  // Add scene transitions for complex descriptions
  if (analysis.complexity === "complex") {
    // Ensure proper sentence structure
    if (
      !improved.endsWith(".") &&
      !improved.endsWith("!") &&
      !improved.endsWith("?")
    ) {
      improved += ".";
    }
  }

  // Add temporal markers for action sequences
  if (analysis.hasAction && analysis.wordCount > 15) {
    improved = improved.replace(/\b(then|next|after|before)\b/g, "");
    improved = improved.replace(
      /\b(action|movement|motion)\b/g,
      "dynamic action",
    );
  }

  return improved;
}

/**
 * Optimizes a prompt for a specific model with intelligent text processing
 */
export function optimizePromptForModel(
  modelId: string,
  basePrompt: string,
): string {
  const strategy = MODEL_PROMPT_STRATEGIES[modelId];

  if (!strategy) {
    console.warn(`No prompt strategy found for model: ${modelId}`);
    return basePrompt;
  }

  // Analyze the input text
  const analysis = analyzeText(basePrompt);

  // Process the text based on model capabilities
  let processedPrompt = basePrompt;

  if (strategy.textProcessing?.enhanceKeywords) {
    processedPrompt = enhanceKeywords(processedPrompt, analysis);
  }

  if (strategy.textProcessing?.addTechnicalTerms) {
    processedPrompt = addTechnicalTerms(processedPrompt, analysis);
  }

  if (strategy.textProcessing?.improveStructure) {
    processedPrompt = improveStructure(processedPrompt, analysis);
  }

  // Apply length constraints
  const maxLength = strategy.textProcessing?.maxLength || 200;
  if (processedPrompt.length > maxLength) {
    processedPrompt = `${processedPrompt.substring(0, maxLength - 3)}...`;
  }

  // Apply model-specific prefix and suffix
  const optimizedPrompt = `${strategy.prefix}${processedPrompt}${strategy.suffix}`;

  console.log(`[${modelId}] Advanced prompt optimization:`, {
    original: basePrompt,
    analysis: {
      complexity: analysis.complexity,
      wordCount: analysis.wordCount,
      hasCharacters: analysis.hasCharacters,
      hasAction: analysis.hasAction,
      hasSetting: analysis.hasSetting,
      hasEmotion: analysis.hasEmotion,
      hasTechnicalTerms: analysis.hasTechnicalTerms,
      hasProperNouns: analysis.hasProperNouns,
      properNouns: analysis.properNouns,
    },
    processed: processedPrompt,
    optimized: optimizedPrompt,
    strategy: strategy.style,
    quality: strategy.quality,
    contextAware: strategy.contextAware,
  });

  return optimizedPrompt;
}
