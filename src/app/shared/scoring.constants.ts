export const SCORE_STEP = 0.05;

export const MAX_TOTAL_SCORE = 17.0;

export interface ScoringCriterion {
  key: string;
  labelSr: string;
  defaultValue: number;
  max: number;
  min: number;
}

export const SCORING_CRITERIA: ScoringCriterion[] = [
  { key: 'color', labelSr: 'Boja', defaultValue: 0.5, max: 1.0, min: 0.0 },
  { key: 'clarity', labelSr: 'Bistrina', defaultValue: 0.5, max: 1.0, min: 0.0 },
  { key: 'typicality', labelSr: 'Tipičnost', defaultValue: 1.0, max: 2.0, min: 0.0 },
  { key: 'aroma', labelSr: 'Miris', defaultValue: 2.5, max: 5.0, min: 0.0 },
  { key: 'taste', labelSr: 'Ukus', defaultValue: 4.0, max: 8.0, min: 0.0 },
];
