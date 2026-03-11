import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
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
  private readonly injector = inject(Injector);
  private readonly samplesRef = collection(this.firestore, 'samples');

  getSampleById(sampleId: string): Observable<Sample | null> {
    return runInInjectionContext(this.injector, () =>
      (docData(doc(this.firestore, `samples/${sampleId}`)) as Observable<Sample | undefined>).pipe(
        map((s) => s ?? null),
      ),
    );
  }

  getAllSamples(): Observable<Sample[]> {
    return runInInjectionContext(this.injector, () =>
      (collectionData(this.samplesRef) as Observable<Sample[]>).pipe(
        map((samples) => samples.sort((a, b) => a.order - b.order)),
      ),
    );
  }

  getSamplesForCategories(categoryIds: string[]): Observable<Sample[]> {
    if (categoryIds.length === 0) return of([]);
    const q = query(this.samplesRef, where('categoryId', 'in', categoryIds.slice(0, 30)));
    return runInInjectionContext(this.injector, () =>
      (collectionData(q) as Observable<Sample[]>).pipe(
        map((samples) => samples.sort((a, b) => a.order - b.order)),
      ),
    );
  }

  getSamplesForProducer(producerId: string): Observable<Sample[]> {
    const q = query(this.samplesRef, where('producerId', '==', producerId));
    return runInInjectionContext(this.injector, () =>
      (collectionData(q) as Observable<Sample[]>).pipe(
        map((samples) => samples.sort((a, b) => a.order - b.order)),
      ),
    );
  }

  getSamplesForCategory(categoryId: string): Observable<Sample[]> {
    const q = query(this.samplesRef, where('categoryId', '==', categoryId));
    return runInInjectionContext(this.injector, () =>
      (collectionData(q) as Observable<Sample[]>).pipe(
        map((samples) => samples.sort((a, b) => a.order - b.order)),
      ),
    );
  }

  getSampleByCode(sampleCode: string, categoryIds: string[]): Observable<Sample | null> {
    if (categoryIds.length === 0) return of(null);
    const q = query(
      this.samplesRef,
      where('sampleCode', '==', sampleCode),
      where('categoryId', 'in', categoryIds.slice(0, 30)),
    );
    return runInInjectionContext(this.injector, () =>
      (collectionData(q) as Observable<Sample[]>).pipe(map((samples) => samples[0] ?? null)),
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
