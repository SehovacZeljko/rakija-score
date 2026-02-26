import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, shareReplay, switchMap, take } from 'rxjs';

import { FestivalEvent } from '../models/event.model';
import { Festival } from '../models/festival.model';
import { EventService } from './event.service';
import { FestivalService } from './festival.service';

@Injectable({ providedIn: 'root' })
export class FestivalContextService {
  private readonly festivalService = inject(FestivalService);
  private readonly eventService = inject(EventService);

  readonly activeFestival$: Observable<Festival | null> = this.festivalService.getActiveFestival().pipe(
    catchError(() => of(null)),
    shareReplay(1),
  );

  readonly activeEvent$: Observable<FestivalEvent | null> = this.activeFestival$.pipe(
    switchMap((f) => (f ? this.eventService.getActiveEvent(f.festivalId) : of(null))),
    catchError(() => of(null)),
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
