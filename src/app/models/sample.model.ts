import { Timestamp } from '@angular/fire/firestore';

export interface Sample {
  sampleId: string;
  producerId: string;
  categoryId: string;
  sampleCode: string;
  year: number;
  alcoholStrength: number;
  order: number;
  createdAt: Timestamp;
}
