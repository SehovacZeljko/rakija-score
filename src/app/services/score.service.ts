import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  documentId,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

import { Score } from '../models/score.model';

@Injectable({ providedIn: 'root' })
export class ScoreService {
  private readonly firestore = inject(Firestore);
  private readonly scoresRef = collection(this.firestore, 'scores');

  getScoresForJudge(judgeId: string): Observable<Score[]> {
    const q = query(this.scoresRef, where('judgeId', '==', judgeId));
    return collectionData(q) as Observable<Score[]>;
  }

  getScoresByDocIds(docIds: string[]): Observable<Score[]> {
    if (docIds.length === 0) return of([]);
    const q = query(this.scoresRef, where(documentId(), 'in', docIds.slice(0, 30)));
    return collectionData(q) as Observable<Score[]>;
  }
}
