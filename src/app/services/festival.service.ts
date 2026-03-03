import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { Festival } from '../models/festival.model';

@Injectable({ providedIn: 'root' })
export class FestivalService {
  private readonly firestore = inject(Firestore);
  private readonly festivalsRef = collection(this.firestore, 'festivals');

  getActiveFestival(): Observable<Festival | null> {
    const q = query(this.festivalsRef, where('status', '==', 'active'), limit(1));
    return (collectionData(q) as Observable<Festival[]>).pipe(
      map((festivals) => festivals[0] ?? null),
    );
  }

  getAllFestivals(): Observable<Festival[]> {
    const q = query(this.festivalsRef, orderBy('createdAt', 'desc'));
    return collectionData(q) as Observable<Festival[]>;
  }

  async createFestival(name: string): Promise<void> {
    const newDocRef = doc(this.festivalsRef);
    await setDoc(newDocRef, {
      festivalId: newDocRef.id,
      name,
      status: 'inactive',
      createdAt: serverTimestamp(),
    });
  }

  async updateFestivalName(festivalId: string, name: string): Promise<void> {
    await updateDoc(doc(this.firestore, `festivals/${festivalId}`), { name });
  }

  async setActiveFestival(festivalId: string): Promise<void> {
    const activeQuery = query(this.festivalsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    // Block if the current active festival has any non-finished events
    if (!snapshot.empty) {
      const activeFestivalIds = snapshot.docs.map((d) => d.id);
      const eventsRef = collection(this.firestore, 'events');
      const nonFinishedQuery = query(
        eventsRef,
        where('festivalId', 'in', activeFestivalIds),
        where('status', 'in', ['staging', 'active']),
        limit(1),
      );
      const eventsSnapshot = await getDocs(nonFinishedQuery);
      if (!eventsSnapshot.empty) {
        throw new Error('NON_FINISHED_EVENTS_EXIST');
      }
    }

    const batch = writeBatch(this.firestore);
    snapshot.docs.forEach((d) => batch.update(d.ref, { status: 'inactive' }));
    batch.update(doc(this.firestore, `festivals/${festivalId}`), { status: 'active' });
    await batch.commit();
  }
}
