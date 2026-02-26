import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { FestivalEvent } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly firestore = inject(Firestore);
  private readonly eventsRef = collection(this.firestore, 'events');

  getEventById(eventId: string): Observable<FestivalEvent | null> {
    const docRef = doc(this.firestore, `events/${eventId}`);
    return (docData(docRef) as Observable<FestivalEvent | undefined>).pipe(
      map((event) => event ?? null),
    );
  }

  getEventsForFestival(festivalId: string): Observable<FestivalEvent[]> {
    const q = query(this.eventsRef, where('festivalId', '==', festivalId));
    return collectionData(q) as Observable<FestivalEvent[]>;
  }

  getActiveEvent(festivalId: string): Observable<FestivalEvent | null> {
    const q = query(this.eventsRef, where('festivalId', '==', festivalId));
    return (collectionData(q) as Observable<FestivalEvent[]>).pipe(
      map((events) => events.find((e) => e.status === 'active') ?? null),
    );
  }

  async createEvent(festivalId: string, name: string, year: number): Promise<void> {
    const newDocRef = doc(this.eventsRef);
    await setDoc(newDocRef, {
      eventId: newDocRef.id,
      festivalId,
      name,
      year,
      status: 'inactive',
      closedAt: null,
      createdAt: serverTimestamp(),
    });
  }

  async setActiveEvent(festivalId: string, eventId: string): Promise<void> {
    const activeQuery = query(
      this.eventsRef,
      where('festivalId', '==', festivalId),
      where('status', '==', 'active'),
    );
    const snapshot = await getDocs(activeQuery);
    const batch = writeBatch(this.firestore);
    snapshot.docs.forEach((d) => batch.update(d.ref, { status: 'inactive' }));
    batch.update(doc(this.firestore, `events/${eventId}`), { status: 'active' });
    await batch.commit();
  }
}
