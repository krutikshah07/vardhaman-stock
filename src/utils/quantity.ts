/**
 * Reusable utility parsing and formatting quantity values
 * to support standard integers, decimals, and fractional inputs (like "1/2", "1 1/2").
 */

export const formatQuantity = (value: number): string => {
  if (value === 0) return "0";
  if (Number.isInteger(value)) return String(value);

  // Check if fractional part is exactly 0.5
  const intPart = Math.floor(value);
  const fracPart = value - intPart;
  if (Math.abs(fracPart - 0.5) < 0.0001) {
    if (intPart === 0) return "1/2";
    return `${intPart} 1/2`;
  }

  // Return standard decimal rounded up to 2 decimal places
  return parseFloat(value.toFixed(2)).toString();
};

export const parseQuantity = (valStr: string): number => {
  const clean = valStr.trim().replace(/\s+/g, ' ');
  if (!clean) return 0;

  // Pattern: mixed fractions like "1 1/2" or "1-1/2"
  const mixedPattern = /^(\d+)[\s|-]+(\d+)\/(\d+)$/;
  const mixedMatch = clean.match(mixedPattern);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    if (den !== 0) {
      return whole + (num / den);
    }
  }

  // Pattern: simple fractions like "1/2"
  const simplePattern = /^(\d+)\/(\d+)$/;
  const simpleMatch = clean.match(simplePattern);
  if (simpleMatch) {
    const num = parseFloat(simpleMatch[1]);
    const den = parseFloat(simpleMatch[2]);
    if (den !== 0) {
      return num / den;
    }
  }

  // Fallback to standard parseFloat
  const parsed = parseFloat(clean);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
};
