import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FilterKey, FilterOption } from './gallery-filters.model';

@Component({
  selector: 'app-filter-dropdown',
  templateUrl: './filter-dropdown.html',
  styleUrl: './filter-dropdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterDropdown {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  readonly filterKey = input.required<FilterKey>();
  readonly label = input.required<string>();
  readonly options = input.required<FilterOption[]>();
  readonly value = input<string | null>(null);
  // Emite el valor elegido; quien lo usa decide si aplicar o quitar el filtro
  readonly chosen = output<string>();

  protected readonly open = signal(false);
  protected readonly panelId = computed(() => `filter-panel-${this.filterKey()}`);
  protected readonly valueLabel = computed(() => {
    const value = this.value();
    if (value === null) {
      return null;
    }
    return this.options().find((option) => option.value === value)?.label ?? value;
  });

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected choose(value: string): void {
    this.open.set(false);
    this.chosen.emit(value);
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.open.set(false);
      this.trigger()?.nativeElement.focus();
    }
  }

  // Clic fuera: solo se ejecuta en el navegador, cuando hay eventos reales
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  // Si el foco sale del componente con Tab, el panel se cierra
  @HostListener('focusout', ['$event'])
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) {
      this.open.set(false);
    }
  }
}
