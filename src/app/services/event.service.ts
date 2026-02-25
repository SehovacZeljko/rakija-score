import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { FestivalEvent } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly firestore = inject(Firestore);
  private readonly eventsRef = collection(this.firestore, 'events');

  getEventsForFestival(festivalId: string): Observable<FestivalEvent[]> {
    const q = query(this.eventsRef, where('festivalId', '==', festivalId));
    return collectionData(q) as Observable<FestivalEvent[]>;
  }

  async createEvent(festivalId: string, name: string, year: number): Promise<void> {
    const newDocRef = doc(this.eventsRef);
    await setDoc(newDocRef, {
      eventId: newDocRef.id,
      festivalId,
      name,
      year,
      status: 'active',
      closedAt: null,
      createdAt: serverTimestamp(),
    });
  }
}
