/**
 * Parse composition text into structured data
 * Example: "Shell: 95% Cotton, 5% Elastane" -> { cotton: 95, elastane: 5, is_cotton_90: true }
 */

/**
 * Parse composition from raw materials text
 * @param {string} text - Raw materials string, e.g. 'Shell: 95% Cotton, 5% Elastane.'
 * @returns {{ composition: Object, isCotton90: boolean }} - Map of fiber -> percentage and cotton 90+ flag
 */
function parseComposition(text) {
  if (!text || typeof text !== 'string') {
    return { composition: {}, isCotton90: false };
  }

  const textLower = text.toLowerCase();
  // Match patterns like "95% cotton", "5% elastane", etc.
  const pattern = /(\d{1,3})%\s*([a-zA-Z\s]+)/g;
  const matches = Array.from(textLower.matchAll(pattern));

  const composition = {};
  const cottonPercents = [];

  for (const match of matches) {
    try {
      const percent = parseFloat(match[1]);
      const fiber = match[2].trim().toLowerCase();
      
      // Clean up fiber name
      const fiberClean = fiber.split(/\s+/).join(' ');
      composition[fiberClean] = percent;
      
      // Track cotton percentages
      if (fiber.includes('cotton')) {
        cottonPercents.push(percent);
      }
    } catch (error) {
      // Skip invalid matches
      continue;
    }
  }

  // Check if any cotton percentage is >= 90%
  const isCotton90 = cottonPercents.some(p => p >= 90.0);

  return {
    composition,
    isCotton90,
  };
}

/**
 * Extract cotton percentage from composition text
 * @param {string} text - Raw materials string
 * @returns {number} - Cotton percentage (0-100) or 0 if not found
 */
function getCottonPercentage(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const textLower = text.toLowerCase();
  const cottonMatch = textLower.match(/(\d{1,3})%\s*cotton/i);
  
  if (cottonMatch) {
    return parseInt(cottonMatch[1], 10);
  }
  
  return 0;
}

module.exports = {
  parseComposition,
  getCottonPercentage,
};
