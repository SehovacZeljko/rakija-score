import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { Producer } from '../models/producer.model';

export type ProducerData = Omit<Producer, 'producerId' | 'createdAt'>;

@Injectable({ providedIn: 'root' })
export class ProducerService {
  private readonly firestore = inject(Firestore);
  private readonly producersRef = collection(this.firestore, 'producers');

  getAllProducers(): Observable<Producer[]> {
    return (collectionData(this.producersRef) as Observable<Producer[]>).pipe(
      map((producers) => producers.sort((a, b) => a.name.localeCompare(b.name))),
    );
  }

  async createProducer(data: ProducerData): Promise<void> {
    const newDocRef = doc(this.producersRef);
    await setDoc(newDocRef, {
      ...data,
      producerId: newDocRef.id,
      createdAt: serverTimestamp(),
    });
  }

  async updateProducer(producerId: string, data: ProducerData): Promise<void> {
    await updateDoc(doc(this.firestore, `producers/${producerId}`), { ...data });
  }
}
