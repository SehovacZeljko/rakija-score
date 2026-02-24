import { Timestamp } from '@angular/fire/firestore';

export interface Score {
  scoreId: string;
  judgeId: string;
  sampleId: string;
  color: number;
  clarity: number;
  typicality: number;
  aroma: number;
  taste: number;
  comment: string;
  scoredAt: Timestamp;
  updatedAt: Timestamp;
}
