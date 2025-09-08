/**
 * Normalizes movie title according to business rules:
 * 1. Remove all non-English letters and non-letter symbols (keep A-Z a-z and spaces)
 * 2. Trim and collapse multiple spaces
 * 3. Capitalize first letter of each word, lowercase the rest
 */
export function normalizeTitle(rawTitle: string): string {
  // Remove all non-English letters and non-letter symbols, keep only A-Z a-z and spaces
  let normalized = rawTitle.replace(/[^A-Za-z ]/g, ' ');
  
  // Trim and collapse multiple spaces into single space
  normalized = normalized.trim().replace(/\s+/g, ' ');
  
  // Capitalize first letter of each word, lowercase the rest
  normalized = normalized
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
    
  return normalized;
}

/**
 * Converts runtime string from OMDB (e.g., "117 min") to minutes number
 */
export function parseRuntime(runtime: string): number | null {
  if (!runtime || runtime === 'N/A') return null;
  
  const match = runtime.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parses year from OMDB format (e.g., "1982", "2019–2023") to number
 */
export function parseYear(year: string): number | null {
  if (!year || year === 'N/A') return null;
  
  // Extract first 4-digit year
  const match = year.match(/(\d{4})/);
  if (match) {
    const yearNum = parseInt(match[1], 10);
    // Basic validation for reasonable years
    if (yearNum >= 1888 && yearNum <= 2100) {
      return yearNum;
    }
  }
  
  return null;
}

/**
 * Parses comma-separated list from OMDB (e.g., "Action, Drama, Sci-Fi") to array
 */
export function parseList(list: string): string[] | null {
  if (!list || list === 'N/A') return null;
  
  const items = list
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
    
  return items.length > 0 ? items : null;
}
