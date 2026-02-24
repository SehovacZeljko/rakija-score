import { Timestamp } from '@angular/fire/firestore';

export interface FestivalEvent {
  eventId: string;
  festivalId: string;
  name: string;
  year: number;
  status: string;
  closedAt: Timestamp | null;
  createdAt: Timestamp;
}
