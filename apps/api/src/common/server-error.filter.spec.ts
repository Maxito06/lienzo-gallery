import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ServerErrorFilter } from './server-error.filter.js';

function setup() {
  const reply = vi.fn();
  const applicationRef = { reply, end: vi.fn(), isHeadersSent: () => false };
  const request = {
    method: 'POST',
    originalUrl: '/admin/artworks?token=secret&email=a@b.com',
    headers: { cookie: 'sid=abc', authorization: 'Bearer x' },
    body: { password: 'hunter2' },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => request }),
    getArgByIndex: (index: number) => (index === 1 ? {} : request),
  } as unknown as ArgumentsHost;
  const filter = new ServerErrorFilter(applicationRef as never);
  const logged: string[] = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
    logged.push(String(message));
  });
  return { filter, host, reply, logged };
}

describe('ServerErrorFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs one JSON line with the expected fields for an unhandled 500', () => {
    const { filter, host, logged } = setup();
    filter.catch(new TypeError('boom'), host);
    expect(logged).toHaveLength(1);
    const entry = JSON.parse(logged[0]);
    expect(Object.keys(entry).sort()).toEqual(
      ['errorName', 'message', 'method', 'path', 'stack', 'status', 'timestamp'].sort(),
    );
    expect(entry).toMatchObject({
      method: 'POST',
      path: '/admin/artworks',
      status: 500,
      errorName: 'TypeError',
      message: 'boom',
    });
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
    expect(entry.stack).toContain('boom');
  });

  it('logs explicit 5xx HttpExceptions', () => {
    const { filter, host, logged } = setup();
    filter.catch(new InternalServerErrorException('db down'), host);
    expect(JSON.parse(logged[0])).toMatchObject({ status: 500, errorName: 'InternalServerErrorException' });
  });

  it('does not log 4xx errors', () => {
    const { filter, host, logged } = setup();
    filter.catch(new BadRequestException('Invalid request'), host);
    filter.catch(new HttpException('Nope', 404), host);
    expect(logged).toEqual([]);
  });

  it('does not log the query string, headers, cookies or body', () => {
    const { filter, host, logged } = setup();
    filter.catch(new Error('boom'), host);
    for (const secret of ['token', 'secret', 'a@b.com', 'sid=abc', 'Bearer', 'hunter2']) {
      expect(logged[0]).not.toContain(secret);
    }
  });

  it('keeps the client response of an unhandled error as the Nest default', () => {
    const { filter, host, reply } = setup();
    filter.catch(new Error('boom'), host);
    expect(reply).toHaveBeenCalledWith({}, { statusCode: 500, message: 'Internal server error' }, 500);
  });

  it('keeps the client response of HttpExceptions unchanged', () => {
    const { filter, host, reply } = setup();
    const exception = new BadRequestException('Invalid request');
    filter.catch(exception, host);
    expect(reply).toHaveBeenCalledWith({}, exception.getResponse(), 400);
  });
});
