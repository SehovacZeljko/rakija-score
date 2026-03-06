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
  updateDoc,
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

  getCurrentAdminEvent(festivalId: string): Observable<FestivalEvent | null> {
    return this.getEventsForFestival(festivalId).pipe(
      map(
        (events) =>
          events.find((e) => e.status === 'active') ??
          events.find((e) => e.status === 'staging') ??
          null,
      ),
    );
  }

  async updateEvent(eventId: string, name: string, year: number): Promise<void> {
    await updateDoc(doc(this.firestore, `events/${eventId}`), { name, year });
  }

  async createEvent(festivalId: string, name: string, year: number): Promise<void> {
    const newDocRef = doc(this.eventsRef);
    await setDoc(newDocRef, {
      eventId: newDocRef.id,
      festivalId,
      name,
      year,
      status: 'staging',
      closedAt: null,
      createdAt: serverTimestamp(),
    });
  }

  async activateEvent(festivalId: string, eventId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `events/${eventId}`), { status: 'active' });
  }

  async finishEvent(eventId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `events/${eventId}`), {
      status: 'finished',
      closedAt: serverTimestamp(),
    });
  }

  async reopenEvent(festivalId: string, eventId: string): Promise<void> {
    const nonFinishedQuery = query(
      this.eventsRef,
      where('festivalId', '==', festivalId),
      where('status', 'in', ['active', 'staging']),
    );
    const snapshot = await getDocs(nonFinishedQuery);

    const batch = writeBatch(this.firestore);

    // Finish all other non-finished events before reopening
    for (const docSnap of snapshot.docs) {
      if (docSnap.id !== eventId) {
        batch.update(docSnap.ref, { status: 'finished', closedAt: serverTimestamp() });
      }
    }

    batch.update(doc(this.firestore, `events/${eventId}`), { status: 'active', closedAt: null });
    await batch.commit();
  }

  async revertToStaging(eventId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `events/${eventId}`), { status: 'staging' });
  }

}
