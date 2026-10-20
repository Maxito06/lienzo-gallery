import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { AdminLayout } from './admin-layout';

describe('AdminLayout', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).user.set({ id: 'a1', email: 'admin@example.com' });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows the navigation links', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const links = Array.from(root.querySelectorAll('nav a')).map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
    }));
    expect(links).toEqual([
      { text: 'Obras', href: '/admin/artworks' },
      { text: 'Técnicas', href: '/admin/techniques' },
      { text: 'Series', href: '/admin/series' },
    ]);
    expect(root.textContent).toContain('admin@example.com');
  });

  it('logs out and navigates to the login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    httpTesting.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });

    expect(TestBed.inject(AuthService).user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/admin/login']);
  });
});
