import { Timestamp } from '@angular/fire/firestore';

export interface User {
  userId: string;
  username: string;
  fullName: string;
  role: 'admin' | 'judge';
  createdAt: Timestamp;
}
