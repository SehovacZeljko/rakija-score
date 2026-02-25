import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly firestore = inject(Firestore);

  getAllUsers(): Observable<User[]> {
    return (collectionData(collection(this.firestore, 'users')) as Observable<User[]>).pipe(
      map((users) => users.sort((a, b) => a.username.localeCompare(b.username))),
    );
  }
}
