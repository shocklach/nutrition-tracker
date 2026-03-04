export interface Entry {
  id: string;
  timestamp: string; // ISO string
  dateKey: string; // YYYY-MM-DD local timezone
  proteinGrams: number; // integer, 0-500
  calories: number; // integer, 0-5000
}

export interface DaySummary {
  dateKey: string;
  totalProtein: number;
  totalCalories: number;
  entryCount: number;
}
