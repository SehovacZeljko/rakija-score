import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { Sample } from '../models/sample.model';

export type SampleData = Omit<Sample, 'sampleId' | 'createdAt'>;

@Injectable({ providedIn: 'root' })
export class SampleService {
  private readonly firestore = inject(Firestore);
  private readonly samplesRef = collection(this.firestore, 'samples');

  getAllSamples(): Observable<Sample[]> {
    return (collectionData(this.samplesRef) as Observable<Sample[]>).pipe(
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
