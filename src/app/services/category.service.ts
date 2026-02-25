import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

import { Category } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly firestore = inject(Firestore);
  private readonly categoriesRef = collection(this.firestore, 'categories');

  getCategoriesForEvent(eventId: string): Observable<Category[]> {
    const q = query(this.categoriesRef, where('eventId', '==', eventId));
    return collectionData(q) as Observable<Category[]>;
  }

  getCategoriesForEvents(eventIds: string[]): Observable<Category[]> {
    if (eventIds.length === 0) return of([]);
    const q = query(this.categoriesRef, where('eventId', 'in', eventIds));
    return collectionData(q) as Observable<Category[]>;
  }

  async createCategory(eventId: string, name: string): Promise<void> {
    const newDocRef = doc(this.categoriesRef);
    await setDoc(newDocRef, {
      categoryId: newDocRef.id,
      eventId,
      name,
      status: 'active',
      createdAt: serverTimestamp(),
    });
  }

  async canDeleteCategory(categoryId: string): Promise<boolean> {
    const samplesSnap = await getDocs(
      query(collection(this.firestore, 'samples'), where('categoryId', '==', categoryId)),
    );
    if (samplesSnap.empty) return true;

    const sampleIds = samplesSnap.docs.map((d) => d.data()['sampleId'] as string);

    for (let i = 0; i < sampleIds.length; i += 30) {
      const chunk = sampleIds.slice(i, i + 30);
      const scoresSnap = await getDocs(
        query(collection(this.firestore, 'scores'), where('sampleId', 'in', chunk), limit(1)),
      );
      if (!scoresSnap.empty) return false;
    }
    return true;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const canDelete = await this.canDeleteCategory(categoryId);
    if (!canDelete) throw new Error('DELETE_BLOCKED');
    await deleteDoc(doc(this.firestore, `categories/${categoryId}`));
  }
}
