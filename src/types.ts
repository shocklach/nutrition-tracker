export interface Entry {
  id: string;
  timestamp: string; // ISO string
  dateKey: string; // YYYY-MM-DD local timezone
  proteinGrams: number; // integer, 0-500
  calories: number; // integer, 0-5000
  saturatedFatGrams: number; // decimals allowed (e.g. 0.5, 1.5), 0-200
  fiberGrams: number; // decimals allowed (e.g. 0.5, 1.5), 0-200
}

export interface DaySummary {
  dateKey: string;
  totalProtein: number;
  totalCalories: number;
  totalSaturatedFat: number;
  totalFiber: number;
  entryCount: number;
}
