import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  documentId,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, of } from 'rxjs';

import { Score } from '../models/score.model';

export interface ScoreData {
  color: number;
  clarity: number;
  typicality: number;
  aroma: number;
  taste: number;
  comment: string;
}

@Injectable({ providedIn: 'root' })
export class ScoreService {
  private readonly firestore = inject(Firestore);
  private readonly scoresRef = collection(this.firestore, 'scores');

  getScore(judgeId: string, sampleId: string): Observable<Score | null> {
    const docRef = doc(this.firestore, `scores/${judgeId}_${sampleId}`);
    return (docData(docRef) as Observable<Score | undefined>).pipe(
      map((score) => score ?? null),
    );
  }

  async saveScore(judgeId: string, sampleId: string, data: ScoreData): Promise<void> {
    const scoreId = `${judgeId}_${sampleId}`;
    const docRef = doc(this.firestore, `scores/${scoreId}`);
    const existing = await getDoc(docRef);
    await setDoc(docRef, {
      scoreId,
      judgeId,
      sampleId,
      ...data,
      scoredAt: existing.exists() ? existing.data()['scoredAt'] : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  getScoresForJudge(judgeId: string): Observable<Score[]> {
    const q = query(this.scoresRef, where('judgeId', '==', judgeId));
    return collectionData(q) as Observable<Score[]>;
  }

  getScoresByDocIds(docIds: string[]): Observable<Score[]> {
    if (docIds.length === 0) return of([]);
    const q = query(this.scoresRef, where(documentId(), 'in', docIds.slice(0, 30)));
    return collectionData(q) as Observable<Score[]>;
  }

  getScoresForSampleIds(sampleIds: string[]): Observable<Score[]> {
    if (sampleIds.length === 0) return of([]);
    const chunks: string[][] = [];
    for (let i = 0; i < sampleIds.length; i += 30) {
      chunks.push(sampleIds.slice(i, i + 30));
    }
    const queries = chunks.map((chunk) => {
      const q = query(this.scoresRef, where('sampleId', 'in', chunk));
      return collectionData(q) as Observable<Score[]>;
    });
    return combineLatest(queries).pipe(map((results) => results.flat()));
  }
}
