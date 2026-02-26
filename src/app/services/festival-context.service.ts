import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, shareReplay, switchMap, take } from 'rxjs';

import { EventService } from './event.service';
import { FestivalService } from './festival.service';

@Injectable({ providedIn: 'root' })
export class FestivalContextService {
  private readonly festivalService = inject(FestivalService);
  private readonly eventService = inject(EventService);

  readonly activeFestival$ = this.festivalService.getActiveFestival().pipe(shareReplay(1));

  readonly activeEvent$ = this.activeFestival$.pipe(
    switchMap((f) => (f ? this.eventService.getActiveEvent(f.festivalId) : of(null))),
    shareReplay(1),
  );

  readonly activeFestival = toSignal(this.activeFestival$, { initialValue: null });
  readonly activeEvent = toSignal(this.activeEvent$, { initialValue: null });

  readonly dataReady = toSignal(
    combineLatest([this.activeFestival$, this.activeEvent$]).pipe(
      take(1),
      map(() => true),
    ),
    { initialValue: false },
  );
}
