import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of } from 'rxjs';

import { Sample } from '../models/sample.model';

export type SampleData = Omit<Sample, 'sampleId' | 'createdAt'>;

@Injectable({ providedIn: 'root' })
export class SampleService {
  private readonly firestore = inject(Firestore);
  private readonly samplesRef = collection(this.firestore, 'samples');

  getSampleById(sampleId: string): Observable<Sample | null> {
    return (
      docData(doc(this.firestore, `samples/${sampleId}`)) as Observable<Sample | undefined>
    ).pipe(map((s) => s ?? null));
  }

  getAllSamples(): Observable<Sample[]> {
    return (collectionData(this.samplesRef) as Observable<Sample[]>).pipe(
      map((samples) => samples.sort((a, b) => a.order - b.order)),
    );
  }

  getSamplesForCategories(categoryIds: string[]): Observable<Sample[]> {
    if (categoryIds.length === 0) return of([]);
    const q = query(this.samplesRef, where('categoryId', 'in', categoryIds.slice(0, 30)));
    return (collectionData(q) as Observable<Sample[]>).pipe(
      map((samples) => samples.sort((a, b) => a.order - b.order)),
    );
  }

  getSamplesForCategory(categoryId: string): Observable<Sample[]> {
    const q = query(this.samplesRef, where('categoryId', '==', categoryId));
    return (collectionData(q) as Observable<Sample[]>).pipe(
      map((samples) => samples.sort((a, b) => a.order - b.order)),
    );
  }

  async createSample(data: SampleData): Promise<void> {
    const newDocRef = doc(this.samplesRef);
    await setDoc(newDocRef, {
      ...data,
      sampleId: newDocRef.id,
      createdAt: serverTimestamp(),
    });
  }

  async updateSample(sampleId: string, data: SampleData): Promise<void> {
    await updateDoc(doc(this.firestore, `samples/${sampleId}`), { ...data });
  }
}
