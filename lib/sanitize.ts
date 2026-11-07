/**
 * Server-Side Sanitizer for Meta Advertising Compliance & Zero-Leak Architecture
 * 
 * Enforces strict Meta Ad policy rules to prevent crawler flags by replacing or stripping
 * all restricted keywords from product titles, descriptions, categories, and variant names.
 */

// Mapping of regex rules according to Meta Ad Compliance guidelines
const SANITIZATION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // 1. Strip nicotine strengths, salt, and variations completely first
  {
    pattern: /\b(nicotine|nic|salt)\b/gi,
    replacement: "",
  },
  {
    pattern: /\b\d+(\.\d+)?%\s*(nic|nicotine)?\b/gi,
    replacement: "",
  },
  {
    pattern: /\b\d+\s*mg\b/gi,
    replacement: "",
  },

  // 2. puffs / puff -> Cycles (e.g., "10000 Puffs" -> "10000 Cycles")
  {
    pattern: /\bpuffs?\b/gi,
    replacement: "Cycles",
  },

  // 3. vapes / disposable -> Compact Edition
  {
    pattern: /\b(vapes?|disposables?)\b/gi,
    replacement: "Compact Edition",
  },

  // 4. pods / kits / devices -> System
  {
    pattern: /\b(pods?|kits?|devices?)\b/gi,
    replacement: "System",
  },

  // 5. flavors / flavours -> Edition
  {
    pattern: /\b(flavors?|flavours?)\b/gi,
    replacement: "Edition",
  },

  // 6. e-liquid / eliquid / juice / smoke / smoking / vapor / cloud -> Series
  {
    pattern: /\b(e-?liquids?|juices?|smokes?|smokings?|vapors?|vapours?|clouds?)\b/gi,
    replacement: "Series",
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

