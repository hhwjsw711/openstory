// Security: Prompt injection protection patterns
export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /forget\s+(all\s+)?previous\s+instructions?/gi,
  /system\s*:[\s\S]*$/gi,
  /assistant\s*:[\s\S]*$/gi,
  /user\s*:[\s\S]*$/gi,
  /<\s*\/?system[^>]*>/gi,
  /<\s*\/?assistant[^>]*>/gi,
  /<\s*\/?user[^>]*>/gi,
  /you\s+are\s+now\s+[\s\S]*$/gi,
  /act\s+as\s+[\s\S]*$/gi,
  /pretend\s+to\s+be[\s\S]*$/gi,
  /roleplay\s+as[\s\S]*$/gi,
  /simulate\s+(being\s+)?[\s\S]*$/gi,
  /output\s+(your|the)\s+(system\s+)?prompt[\s\S]*$/gi,
  /what\s+(is\s+)?your\s+(system\s+)?prompt[\s\S]*$/gi,
  /reveal\s+(your|the)\s+(system\s+)?prompt[\s\S]*$/gi,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt[\s\S]*$/gi,
  /```[\s\S]*?```/g,
  /{\s*"[\s\S]*?"[\s\S]*?}/gi, // JSON-like structures
];

// Security: Sanitize user input to prevent prompt injection
export const sanitizeScriptContent = (input: string): string => {
  let sanitized = input;

  // First, handle code blocks and JSON structures (greedy matching)
  sanitized = sanitized.replace(/```[\s\S]*?```/gi, "[technical content]");
  sanitized = sanitized.replace(
    /{\s*"[\s\S]*?"[\s\S]*?}/g,
    "[structured data]"
  );

  // Remove XML-like tags and their content to prevent complex injection
  sanitized = sanitized.replace(
    /<[^>]*>[\s\S]*?<\/[^>]*>/gi,
    "[markup removed]"
  );
  sanitized = sanitized.replace(/<[^>]*>/g, "[markup removed]");

  // Handle instruction injection patterns
  sanitized = sanitized.replace(
    /ignore\s+(all\s+)?previous\s+instructions?[\s\S]*$/gi,
    "[character dismisses something]"
  );
  sanitized = sanitized.replace(
    /forget\s+(all\s+)?previous\s+instructions?[\s\S]*$/gi,
    "[character dismisses something]"
  );

  // Handle role manipulation
  sanitized = sanitized.replace(
    /you\s+are\s+now\s+[\s\S]*$/gi,
    "[character takes on a role]"
  );
  sanitized = sanitized.replace(
    /act\s+as\s+[\s\S]*$/gi,
    "[character takes on a role]"
  );
  sanitized = sanitized.replace(
    /pretend\s+to\s+be[\s\S]*$/gi,
    "[character takes on a role]"
  );
  sanitized = sanitized.replace(
    /roleplay\s+as[\s\S]*$/gi,
    "[character takes on a role]"
  );
  sanitized = sanitized.replace(
    /simulate\s+(being\s+)?[\s\S]*$/gi,
    "[character takes on a role]"
  );

  // Handle prompt extraction attempts
  sanitized = sanitized.replace(
    /output\s+(your|the)\s+(system\s+)?prompt[\s\S]*$/gi,
    "[technical discussion]"
  );
  sanitized = sanitized.replace(
    /what\s+(is\s+)?your\s+(system\s+)?prompt[\s\S]*$/gi,
    "[technical discussion]"
  );
  sanitized = sanitized.replace(
    /reveal\s+(your|the)\s+(system\s+)?prompt[\s\S]*$/gi,
    "[technical discussion]"
  );
  sanitized = sanitized.replace(
    /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt[\s\S]*$/gi,
    "[technical discussion]"
  );

  // Handle role indicators
  sanitized = sanitized.replace(
    /system\s*:[\s\S]*$/gi,
    "[technical discussion]"
  );
  sanitized = sanitized.replace(
    /assistant\s*:[\s\S]*$/gi,
    "[technical discussion]"
  );
  sanitized = sanitized.replace(/user\s*:[\s\S]*$/gi, "[technical discussion]");

  // Clean up any remaining suspicious fragments
  sanitized = sanitized.replace(
    /\bsystem\s+prompt\b/gi,
    "[technical discussion]"
  );
  sanitized = sanitized.replace(
    /\bprevious\s+instructions?\b/gi,
    "[earlier guidance]"
  );
  sanitized = sanitized.replace(
    /\bcomplete\s+instructions?\b/gi,
    "[full guidance]"
  );

  // Limit length to prevent abuse
  if (sanitized.length > 5000) {
    sanitized = `${sanitized.substring(0, 5000)}... [content truncated for safety]`;
  }

  return sanitized.trim();
};

export const checkForInjectionAttempts = (script: string): boolean => {
  const containsSuspiciousContent = INJECTION_PATTERNS.some((pattern) =>
    pattern.test(script)
  );

  if (containsSuspiciousContent) {
    console.warn("Script enhancement: Potential injection attempt detected", {
      timestamp: new Date().toISOString(),
      scriptLength: script.length,
      suspiciousPatterns: INJECTION_PATTERNS.filter((pattern) =>
        pattern.test(script)
      ).map((pattern) => pattern.source),
    });
  }
  return containsSuspiciousContent;
};

// Security: Validate that AI response follows expected format
// Throws an error if the response is not valid
export const validateAIResponse = (response: string): void => {
  // Check for potential injection attempts in AI response
  const suspiciousPatterns = [
    /system\s*prompt/gi,
    /previous\s+instructions/gi,
    /ignore.*instructions/gi,
    /I\s+am\s+an?\s+AI/gi,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(response)) {
      throw new Error("AI response contains potentially injected content");
    }
  }

  // Ensure response is within reasonable length
  if (response.length > 15000) {
    throw new Error("AI response exceeds maximum safe length");
  }
};
