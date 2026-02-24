import { Timestamp } from '@angular/fire/firestore';

export interface Festival {
  festivalId: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
}
