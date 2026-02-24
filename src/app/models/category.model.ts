import { Timestamp } from '@angular/fire/firestore';

export interface Category {
  categoryId: string;
  eventId: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
}
