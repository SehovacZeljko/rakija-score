import { Timestamp } from '@angular/fire/firestore';

export interface FestivalEvent {
  eventId: string;
  festivalId: string;
  name: string;
  year: number;
  status: 'staging' | 'active' | 'finished';
  closedAt: Timestamp | null;
  createdAt: Timestamp;
}
