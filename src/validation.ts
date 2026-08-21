export interface Macros {
  proteinGrams: number;
  calories: number;
  saturatedFatGrams: number;
  fiberGrams: number;
}

export interface MacroFields {
  protein: string;
  calories: string;
  saturatedFat: string;
  fiber: string;
}

// Mirrors the bounds enforced by the log-entry workflow in the data repo, so an
// entry rejected here would also be rejected coming from ChatGPT.
const BOUNDS = {
  protein: { max: 500, label: "Protein must be 0-500g." },
  calories: { max: 5000, label: "Calories must be 0-5000." },
  saturatedFat: { max: 200, label: "Saturated fat must be 0-200g." },
  fiber: { max: 200, label: "Fiber must be 0-200g." },
};

export type ValidationResult =
  | { ok: true; macros: Macros }
  | { ok: false; error: string };

export function parseMacros(fields: MacroFields): ValidationResult {
  const proteinGrams = parseInt(fields.protein, 10);
  const calories = parseInt(fields.calories, 10);
  const saturatedFatGrams = parseFloat(fields.saturatedFat);
  const fiberGrams = parseFloat(fields.fiber);

  if (
    isNaN(proteinGrams) ||
    isNaN(calories) ||
    isNaN(saturatedFatGrams) ||
    isNaN(fiberGrams)
  ) {
    return { ok: false, error: "Enter valid numbers." };
  }

  const checks: [number, { max: number; label: string }][] = [
    [proteinGrams, BOUNDS.protein],
    [calories, BOUNDS.calories],
    [saturatedFatGrams, BOUNDS.saturatedFat],
    [fiberGrams, BOUNDS.fiber],
  ];
  for (const [value, bound] of checks) {
    if (value < 0 || value > bound.max) return { ok: false, error: bound.label };
  }

  return { ok: true, macros: { proteinGrams, calories, saturatedFatGrams, fiberGrams } };
}
