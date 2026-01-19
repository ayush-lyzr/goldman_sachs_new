import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes a JSON string by replacing problematic characters with valid JSON characters
 * @param jsonString - The JSON string to sanitize
 * @returns The sanitized JSON string
 */
export function sanitizeJsonString(jsonString: string): string {
  let cleaned = jsonString.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  // Remove BOM (Byte Order Mark)
  cleaned = cleaned.replace(/^\uFEFF/, '');
  
  // Replace curly/smart quotes with straight quotes
  // Left double quotation mark → straight quote
  cleaned = cleaned.replace(/[\u201C]/g, '"');
  // Right double quotation mark → straight quote
  cleaned = cleaned.replace(/[\u201D]/g, '"');
  // Left single quotation mark → straight single quote
  cleaned = cleaned.replace(/[\u2018]/g, "'");
  // Right single quotation mark → straight single quote
  cleaned = cleaned.replace(/[\u2019]/g, "'");
  // Double low-9 quotation mark → straight quote
  cleaned = cleaned.replace(/[\u201E]/g, '"');
  // Single low-9 quotation mark → straight single quote
  cleaned = cleaned.replace(/[\u201A]/g, "'");
  // Double high-reversed-9 quotation mark → straight quote
  cleaned = cleaned.replace(/[\u201F]/g, '"');
  // Prime and double prime marks → straight quotes
  cleaned = cleaned.replace(/[\u2032]/g, "'");
  cleaned = cleaned.replace(/[\u2033]/g, '"');
  
  // Replace other problematic characters
  // En dash and em dash → regular hyphen
  cleaned = cleaned.replace(/[\u2013\u2014]/g, '-');
  // Horizontal ellipsis → three dots
  cleaned = cleaned.replace(/[\u2026]/g, '...');
  // Non-breaking space → regular space
  cleaned = cleaned.replace(/\u00A0/g, ' ');
  // Zero-width space and other zero-width characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return cleaned;
}

/**
 * Safely parses a JSON string with automatic sanitization and error handling
 * @param jsonString - The JSON string to parse
 * @param context - Optional context for better error messages
 * @returns The parsed JSON object
 * @throws Error with detailed message if parsing fails
 */
export function safeJsonParse<T = unknown>(
  jsonString: string,
  context?: string
): T {
  try {
    const sanitized = sanitizeJsonString(jsonString);
    return JSON.parse(sanitized) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";
    const contextStr = context ? ` (${context})` : "";
    
    // Get position info if available
    const positionMatch = errorMessage.match(/position (\d+)/);
    const position = positionMatch ? parseInt(positionMatch[1], 10) : null;
    
    // Create a helpful error message with context
    let detailedMessage = `Failed to parse JSON${contextStr}: ${errorMessage}`;
    
    if (position !== null) {
      const start = Math.max(0, position - 50);
      const end = Math.min(jsonString.length, position + 50);
      const snippet = jsonString.substring(start, end);
      const marker = ' '.repeat(Math.min(50, position - start)) + '^';
      
      detailedMessage += `\n\nNear position ${position}:\n${snippet}\n${marker}`;
    } else {
      // Show first 200 characters if no position info
      const preview = jsonString.substring(0, 200);
      detailedMessage += `\n\nFirst 200 characters:\n${preview}${jsonString.length > 200 ? '...' : ''}`;
    }
    
    throw new Error(detailedMessage);
  }
}

/**
 * Attempts to parse JSON with multiple strategies and returns a result object
 * @param jsonString - The JSON string to parse
 * @returns Object with success status, data if successful, or error details if failed
 */
export function tryParseJson<T = unknown>(
  jsonString: string
): { success: true; data: T; raw: string } | { success: false; error: string; raw: string; parseError?: string } {
  const raw = jsonString;
  
  try {
    const data = safeJsonParse<T>(jsonString);
    return { success: true, data, raw };
  } catch (error) {
    return {
      success: false,
      error: "Failed to parse agent response",
      raw,
      parseError: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
