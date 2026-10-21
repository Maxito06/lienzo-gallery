import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SLOW_LOADING_DELAY_MS, SlowLoadingHint } from './slow-loading-hint';

@Component({
  imports: [SlowLoadingHint],
  template: `@if (loading()) {
    <app-slow-loading-hint />
  }`,
})
class Host {
  readonly loading = signal(true);
}

describe('SlowLoadingHint', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  };
  const status = (fixture: ReturnType<typeof setup>) =>
    (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');

  it('is not shown before 4 seconds', () => {
    const fixture = setup();
    vi.advanceTimersByTime(SLOW_LOADING_DELAY_MS - 1);
    fixture.detectChanges();
    expect(status(fixture)).toBeNull();
  });

  it('is shown after 4 seconds', () => {
    const fixture = setup();
    vi.advanceTimersByTime(SLOW_LOADING_DELAY_MS);
    fixture.detectChanges();
    expect(status(fixture)?.textContent).toContain('La galería estaba en reposo');
  });

  it('disappears when loading ends', () => {
    const fixture = setup();
    vi.advanceTimersByTime(SLOW_LOADING_DELAY_MS);
    fixture.detectChanges();
    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();
    expect(status(fixture)).toBeNull();
  });

  it('leaves no pending timers after destroy', () => {
    const fixture = setup();
    expect(vi.getTimerCount()).toBe(1);
    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(0);
  });
});
