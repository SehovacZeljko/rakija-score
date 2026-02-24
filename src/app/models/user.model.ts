import { Timestamp } from '@angular/fire/firestore';

export interface User {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'judge';
  createdAt: Timestamp;
}
