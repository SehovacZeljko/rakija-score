import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
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
  private readonly injector = inject(Injector);
  private readonly eventsRef = collection(this.firestore, 'events');

  getEventById(eventId: string): Observable<FestivalEvent | null> {
    const docRef = doc(this.firestore, `events/${eventId}`);
    return runInInjectionContext(this.injector, () =>
      (docData(docRef) as Observable<FestivalEvent | undefined>).pipe(
        map((event) => event ?? null),
      ),
    );
  }

  getEventsForFestival(festivalId: string): Observable<FestivalEvent[]> {
    const q = query(this.eventsRef, where('festivalId', '==', festivalId));
    return runInInjectionContext(this.injector, () => collectionData(q) as Observable<FestivalEvent[]>);
  }

  getActiveEvent(festivalId: string): Observable<FestivalEvent | null> {
    const q = query(this.eventsRef, where('festivalId', '==', festivalId));
    return runInInjectionContext(this.injector, () =>
      (collectionData(q) as Observable<FestivalEvent[]>).pipe(
        map((events) => events.find((e) => e.status === 'active') ?? null),
      ),
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

  private async buildGlobalTransitionBatch(
    festivalId: string,
    eventId: string,
    allFestivalIds: string[],
    targetStatus: 'active' | 'staging',
  ): Promise<ReturnType<typeof writeBatch>> {
    const batch = writeBatch(this.firestore);

    // 1. Set target festival active, all others inactive
    for (const fId of allFestivalIds) {
      batch.update(doc(this.firestore, `festivals/${fId}`), {
        status: fId === festivalId ? 'active' : 'inactive',
      });
    }

    // 2. Finish all non-finished events in OTHER festivals
    for (const fId of allFestivalIds.filter((id) => id !== festivalId)) {
      const snapshot = await runInInjectionContext(this.injector, () =>
        getDocs(
          query(this.eventsRef, where('festivalId', '==', fId), where('status', 'in', ['active', 'staging'])),
        ),
      );
      for (const docSnap of snapshot.docs) {
        batch.update(docSnap.ref, { status: 'finished', closedAt: serverTimestamp() });
      }
    }

    // 3. Finish all other non-finished events in the SAME festival
    const sameFestivalSnapshot = await runInInjectionContext(this.injector, () =>
      getDocs(
        query(this.eventsRef, where('festivalId', '==', festivalId), where('status', 'in', ['active', 'staging'])),
      ),
    );
    for (const docSnap of sameFestivalSnapshot.docs) {
      if (docSnap.id !== eventId) {
        batch.update(docSnap.ref, { status: 'finished', closedAt: serverTimestamp() });
      }
    }

    // 4. Set target event to targetStatus
    batch.update(doc(this.firestore, `events/${eventId}`), { status: targetStatus, closedAt: null });

    return batch;
  }

  async activateEvent(festivalId: string, eventId: string, allFestivalIds: string[]): Promise<void> {
    const batch = await this.buildGlobalTransitionBatch(festivalId, eventId, allFestivalIds, 'active');
    await batch.commit();
  }

  async finishEvent(eventId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `events/${eventId}`), {
      status: 'finished',
      closedAt: serverTimestamp(),
    });
  }

  async reopenEvent(festivalId: string, eventId: string, allFestivalIds: string[]): Promise<void> {
    const batch = await this.buildGlobalTransitionBatch(festivalId, eventId, allFestivalIds, 'active');
    await batch.commit();
  }

  async revertFinishedToStaging(festivalId: string, eventId: string, allFestivalIds: string[]): Promise<void> {
    const batch = await this.buildGlobalTransitionBatch(festivalId, eventId, allFestivalIds, 'staging');
    await batch.commit();
  }

  async switchContextToEvent(
    festivalId: string,
    eventId: string,
    allFestivalIds: string[],
    currentStatus: 'staging' | 'active' | 'finished',
  ): Promise<void> {
    const targetStatus = currentStatus === 'active' ? 'active' : 'staging';
    const batch = await this.buildGlobalTransitionBatch(festivalId, eventId, allFestivalIds, targetStatus);
    await batch.commit();
  }

  async revertToStaging(eventId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `events/${eventId}`), { status: 'staging' });
  }

  async finishAllNonFinishedEvents(festivalId: string): Promise<void> {
    const nonFinishedQuery = query(
      this.eventsRef,
      where('festivalId', '==', festivalId),
      where('status', 'in', ['active', 'staging']),
    );
    const snapshot = await runInInjectionContext(this.injector, () => getDocs(nonFinishedQuery));
    if (snapshot.empty) return;

    const batch = writeBatch(this.firestore);
    for (const docSnap of snapshot.docs) {
      batch.update(docSnap.ref, { status: 'finished', closedAt: serverTimestamp() });
    }
    await batch.commit();
  }

}
