import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ArtworksService } from './artworks.service';

describe('ArtworksService', () => {
  let service: ArtworksService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ArtworksService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('sends the PATCH to the right URL when updating', () => {
    service.update('a1', { title: 'New title' }).subscribe();

    const req = httpTesting.expectOne('/api/admin/artworks/a1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ title: 'New title' });
    req.flush({});
  });

  it('sends POST requests to the publish and unpublish URLs', () => {
    service.publish('a1').subscribe();
    service.unpublish('a1').subscribe();

    const publish = httpTesting.expectOne('/api/admin/artworks/a1/publish');
    const unpublish = httpTesting.expectOne('/api/admin/artworks/a1/unpublish');
    expect(publish.request.method).toBe('POST');
    expect(unpublish.request.method).toBe('POST');
    publish.flush({});
    unpublish.flush({});
  });
});
