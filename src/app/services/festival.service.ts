import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
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
  private readonly injector = inject(Injector);
  private readonly festivalsRef = collection(this.firestore, 'festivals');

  getActiveFestival(): Observable<Festival | null> {
    const q = query(this.festivalsRef, where('status', '==', 'active'), limit(1));
    return runInInjectionContext(this.injector, () =>
      (collectionData(q) as Observable<Festival[]>).pipe(
        map((festivals) => festivals[0] ?? null),
      ),
    );
  }

  getAllFestivals(): Observable<Festival[]> {
    const q = query(this.festivalsRef, orderBy('createdAt', 'desc'));
    return runInInjectionContext(this.injector, () => collectionData(q) as Observable<Festival[]>);
  }

  async createFestival(name: string): Promise<string> {
    const newDocRef = doc(this.festivalsRef);
    await setDoc(newDocRef, {
      festivalId: newDocRef.id,
      name,
      status: 'inactive',
      createdAt: serverTimestamp(),
    });
    return newDocRef.id;
  }

  async updateFestivalName(festivalId: string, name: string): Promise<void> {
    await updateDoc(doc(this.firestore, `festivals/${festivalId}`), { name });
  }

  async setActiveFestival(festivalId: string): Promise<void> {
    const activeQuery = query(this.festivalsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    const batch = writeBatch(this.firestore);
    snapshot.docs.forEach((d) => batch.update(d.ref, { status: 'inactive' }));
    batch.update(doc(this.firestore, `festivals/${festivalId}`), { status: 'active' });
    await batch.commit();
  }
}
