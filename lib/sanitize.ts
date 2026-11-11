/**
 * Server-Side Sanitizer for Meta Advertising Compliance & Zero-Leak Architecture
 * 
 * Enforces strict Meta Ad policy rules to prevent crawler flags by replacing or stripping
 * all restricted keywords from product titles, descriptions, categories, and variant names.
 */

// Mapping of regex rules according to Meta Ad Compliance guidelines
const SANITIZATION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // 1. Strip nicotine strengths, salt, mg, percentages, and variations completely first
  {
    pattern: /\b(nicotine\w*|nic\b|salt\s*nic|freebase)\b/gi,
    replacement: "",
  },
  {
    pattern: /\d+(\.\d+)?\s*%/g, // Matches 5%, 2%, 5 %, etc.
    replacement: "",
  },
  {
    pattern: /\b\d+\s*mg(\/ml)?\b/gi, // Matches 50mg, 30mg, etc.
    replacement: "",
  },

  // 2. puffs / puff / hits / draws -> Cycles (e.g., "10000 Puffs" -> "10000 Cycles")
  {
    pattern: /\b(puff\w*|hits?|draws?)\b/gi,
    replacement: "Cycles",
  },
  {
    pattern: /-(puffs?|hits?)-/gi,
    replacement: "-cycles-",
  },

  // 3. vapes / vaping / vapers / disposable -> Compact Edition
  {
    pattern: /\b(vape\w*|vaping|disposables?|e-?cigs?|e-?cigarettes?)\b/gi,
    replacement: "Compact Edition",
  },

  // 4. Pod system / pods / kits / mods / cartridges -> Device
  {
    pattern: /\b(pod\s*systems?|pods?\s*systems?|mods?\s*kits?)\b/gi,
    replacement: "Device",
  },
  {
    pattern: /\b(pods?|kits?|mods?|cartridges?)\b/gi,
    replacement: "Device",
  },

  // 5. tobacco / cuban / cigar -> Classic (e.g., "Caramel Tobacco" -> "Caramel Classic")
  {
    pattern: /\b(tobacco\w*|cuban\w*|cigar\w*)\b/gi,
    replacement: "Classic",
  },
  {
    pattern: /-tobacco/gi,
    replacement: "-classic",
  },

  // 6. flavors / flavours / tastes -> Edition
  {
    pattern: /\b(flavors?|flavours?|tastes?)\b/gi,
    replacement: "Edition",
  },

  // 7. e-liquid / eliquid / juice / smoke / smoking / vapor / cloud -> Series
  {
    pattern: /\b(e-?liquids?|eliquids?|e-?juices?|juices?|smoke\w*|vapors?|vapours?|clouds?|inhale\w*|exhale\w*)\b/gi,
    replacement: "Series",
  },

  // 8. Inhaliq brand references -> Urban Series
  {
    pattern: /\binhaliq\w*\b/gi,
    replacement: "Urban Series",
  },
];

/**
 * Strips raw HTML tags from input string and decodes basic entities.
 */
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ") // Strip HTML tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/**
 * Cleans excessive whitespace, leading/trailing punctuation artifacts, and double spaces.
 */
export function cleanWhitespace(input: string): string {
  if (!input) return "";
  return input
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\s+([,.-])/g, "$1") // Fix spaced commas/periods
    .replace(/([,.-])\s*[,.-]+/g, "$1") // Remove duplicate punctuation
    .replace(/\b(Device|System|Edition|Series|Compact Edition)\s+\1\b/gi, "$1") // Remove duplicate repeated words
    .trim();
}

/**
 * Sanitizes any raw text string to comply with Meta Ad policies.
 * Runs strictly on the server before passing data to Client Components.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";

  // 1. Strip raw HTML
  let sanitized = stripHtml(text);

  // 2. Apply all sanitization replacement rules
  for (const { pattern, replacement } of SANITIZATION_RULES) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // 3. Clean up extra whitespace and redundant spaces
  return cleanWhitespace(sanitized);
}

/**
 * Sanitizes an object with product details (specs, variants, titles).
 */
export function sanitizeProductData<T extends { name?: string; shortSpecs?: string }>(product: T): T {
  return {
    ...product,
    name: product.name ? sanitizeText(product.name) : "",
    shortSpecs: product.shortSpecs ? sanitizeText(product.shortSpecs) : "",
  };
}

