import { Timestamp } from '@angular/fire/firestore';

export interface FestivalEvent {
  eventId: string;
  festivalId: string;
  name: string;
  year: number;
  status: 'active' | 'inactive';
  closedAt: Timestamp | null;
  createdAt: Timestamp;
}
