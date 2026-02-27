import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, catchError, map, of, shareReplay, switchMap, take } from 'rxjs';

import { FestivalEvent } from '../models/event.model';
import { Festival } from '../models/festival.model';
import { EventService } from './event.service';
import { FestivalService } from './festival.service';

@Injectable({ providedIn: 'root' })
export class FestivalContextService {
  private readonly festivalService = inject(FestivalService);
  private readonly eventService = inject(EventService);
  private readonly auth = inject(Auth);

  // Tied to authState so that switching users triggers a fresh Firestore subscription.
  // Previously, catchError completed the stream on permission errors during user switches,
  // and shareReplay(1) cached that completion — causing null to be returned permanently.
  readonly activeFestival$: Observable<Festival | null> = authState(this.auth).pipe(
    switchMap((user) =>
      user
        ? this.festivalService.getActiveFestival().pipe(catchError(() => of(null)))
        : of(null),
    ),
    shareReplay(1),
  );

  readonly activeEvent$: Observable<FestivalEvent | null> = this.activeFestival$.pipe(
    switchMap((f) =>
      f
        ? this.eventService.getActiveEvent(f.festivalId).pipe(catchError(() => of(null)))
        : of(null),
    ),
    shareReplay(1),
  );

  readonly activeFestival = toSignal(this.activeFestival$, { initialValue: null });
  readonly activeEvent = toSignal(this.activeEvent$, { initialValue: null });

  readonly dataReady = toSignal(
    this.activeFestival$.pipe(
      take(1),
      map(() => true),
    ),
    { initialValue: false },
  );
}
