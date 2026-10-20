import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_NAME_LENGTH = 80;

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function invalid(): never {
  throw new BadRequestException('Invalid request');
}

export function parseUuid(id: string, notFoundMessage: string): string {
  if (!UUID_REGEX.test(id)) throw new NotFoundException(notFoundMessage);
  return id;
}

export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) invalid();
  return body as Record<string, unknown>;
}

export function parseNameEs(value: unknown): string {
  if (typeof value !== 'string') return invalid();
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return invalid();
  return name;
}

// Una cadena vacía tras recortar se guarda como null
export function parseNameEn(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return invalid();
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) return invalid();
  return name.length === 0 ? null : name;
}
