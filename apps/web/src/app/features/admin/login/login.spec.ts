import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { csrfInterceptor } from '../../../core/csrf.interceptor';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  const fill = (selector: string, value: string) => {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const submit = () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  const fillValidCredentials = () => {
    fill('#email', 'admin@example.com');
    fill('#password', 'secret-password');
  };

  // La pantalla despierta la API al iniciar; se responde para no dejar peticiones pendientes
  const answerWakeUp = () => httpTesting.expectOne('/api/health').flush({ status: 'ok' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Login);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    answerWakeUp();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows validation errors without calling the API when the form is empty', () => {
    submit();

    expect(root.querySelectorAll('.field-error').length).toBe(2);
    httpTesting.expectNone('/api/auth/login');
  });

  it('shows the invalid credentials message on 401', () => {
    fillValidCredentials();
    submit();

    httpTesting
      .expectOne('/api/auth/login')
      .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Correo o contraseña incorrectos.',
    );
  });

  it('shows the retry time on 429 using Retry-After', () => {
    fillValidCredentials();
    submit();

    httpTesting
      .expectOne('/api/auth/login')
      .flush(
        { message: 'Too many attempts' },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '600' } },
      );
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Vuelve a intentarlo en 10 minutos.',
    );
  });

  it('navigates to /admin on successful login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fillValidCredentials();
    submit();

    httpTesting
      .expectOne('/api/auth/login')
      .flush({ admin: { id: 'a1', email: 'admin@example.com' } });

    expect(navigate).toHaveBeenCalledWith(['/admin']);
  });
});

describe('Login wake-up notice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the waking notice when the API takes more than 3 seconds to answer', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Login);
    const root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    expect(root.querySelector('[role="status"]')).toBeNull();
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'El servidor se está despertando',
    );

    httpTesting.expectOne('/api/health').flush({ status: 'ok' });
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')).toBeNull();
    httpTesting.verify();
  });
});
