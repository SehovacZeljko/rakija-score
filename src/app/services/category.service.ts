import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

import { Category } from '../models/category.model';
import { JudgeAssignment } from '../models/judge-assignment.model';

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

  getJudgeAssignments(judgeId: string): Observable<JudgeAssignment[]> {
    const q = query(
      collection(this.firestore, 'judgeAssignments'),
      where('judgeId', '==', judgeId),
    );
    return collectionData(q) as Observable<JudgeAssignment[]>;
  }

  getCategoriesByIds(categoryIds: string[]): Observable<Category[]> {
    if (categoryIds.length === 0) return of([]);
    const q = query(this.categoriesRef, where(documentId(), 'in', categoryIds.slice(0, 30)));
    return collectionData(q) as Observable<Category[]>;
  }

  getAssignmentsForCategories(categoryIds: string[]): Observable<JudgeAssignment[]> {
    if (categoryIds.length === 0) return of([]);
    const q = query(
      collection(this.firestore, 'judgeAssignments'),
      where('categoryId', 'in', categoryIds.slice(0, 30)),
    );
    return collectionData(q) as Observable<JudgeAssignment[]>;
  }

  async assignJudgeToCategory(judgeId: string, categoryId: string): Promise<void> {
    const assignmentId = `${judgeId}_${categoryId}`;
    await setDoc(doc(this.firestore, `judgeAssignments/${assignmentId}`), {
      assignmentId,
      judgeId,
      categoryId,
      status: 'active',
    });
  }

  async lockCategory(judgeId: string, categoryId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `judgeAssignments/${judgeId}_${categoryId}`), {
      status: 'finished',
    });
  }

  async removeJudgeFromCategory(judgeId: string, categoryId: string): Promise<void> {
    const samplesSnap = await getDocs(
      query(collection(this.firestore, 'samples'), where('categoryId', '==', categoryId)),
    );

    if (!samplesSnap.empty) {
      const scoreIds = samplesSnap.docs.map((d) => `${judgeId}_${d.data()['sampleId']}`);
      for (let i = 0; i < scoreIds.length; i += 30) {
        const chunk = scoreIds.slice(i, i + 30);
        const scoresSnap = await getDocs(
          query(collection(this.firestore, 'scores'), where(documentId(), 'in', chunk), limit(1)),
        );
        if (!scoresSnap.empty) throw new Error('UNASSIGN_BLOCKED');
      }
    }

    await deleteDoc(doc(this.firestore, `judgeAssignments/${judgeId}_${categoryId}`));
  }
}
