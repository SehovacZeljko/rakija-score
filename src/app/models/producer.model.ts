import { Timestamp } from '@angular/fire/firestore';

export interface Producer {
  producerId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  region: string;
  country: string;
  createdAt: Timestamp;
}
