import 'dotenv/config';

// Identificador del servidor de Neon (ep-...), sin el sufijo -pooler.
function endpointId(connectionString: string): string {
  const host = new URL(connectionString).hostname;
  return host.split('.')[0].replace(/-pooler$/, '');
}

// Devuelve la dirección de la base de pruebas y aborta si es la misma que la real.
export function getTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('Falta TEST_DATABASE_URL en apps/api/.env');
  }
  const testEndpoint = endpointId(testUrl);
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    const other = process.env[name];
    if (other && endpointId(other) === testEndpoint) {
      throw new Error(
        `TEST_DATABASE_URL apunta al mismo servidor que ${name}. Las pruebas borran los datos: abortando.`,
      );
    }
  }
  return testUrl;
}
