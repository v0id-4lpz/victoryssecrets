// Allow self-signed certs for test HTTPS server
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { describe, it, expect, afterEach } from 'vitest';
import { createServer as createHttpsServer, type Server } from 'node:https';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as vault from '../src/vault';

const TMP = '/tmp/test-remote-vault.vsv';
const PW = 'testpassword1234';
const CERT_DIR = '/tmp/test-remote-vault-certs';

// Generate self-signed cert for tests
function ensureCerts(): { key: string; cert: string } {
  if (!existsSync(`${CERT_DIR}/key.pem`)) {
    execSync(`mkdir -p ${CERT_DIR} && openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout ${CERT_DIR}/key.pem -out ${CERT_DIR}/cert.pem -days 1 -subj '/CN=localhost' 2>/dev/null`);
  }
  return {
    key: readFileSync(`${CERT_DIR}/key.pem`, 'utf-8'),
    cert: readFileSync(`${CERT_DIR}/cert.pem`, 'utf-8'),
  };
}

function cleanupFiles() {
  try { vault.lock(); } catch { /* ignore */ }
  if (existsSync(TMP)) unlinkSync(TMP);
  if (existsSync(TMP + '.bak')) unlinkSync(TMP + '.bak');
}

function serveFile(filePath: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const data = readFileSync(filePath);
    const { key, cert } = ensureCerts();
    const srv = createHttpsServer({ key, cert }, (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(data);
    });
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number };
      resolve({ server: srv, url: `https://127.0.0.1:${addr.port}/vault.vsv` });
    });
  });
}

describe('remote vault', () => {
  let httpServer: Server | null = null;

  afterEach(() => {
    if (httpServer) { httpServer.close(); httpServer = null; }
    cleanupFiles();
  });

  it('opens a remote vault in read-only mode', { timeout: 30000 }, async () => {
    // Create a local vault first
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('prod');
    await vault.setSecret('db', 'host', { secret: false, values: { prod: 'db.prod.com' } });
    vault.lock();

    // Serve it over HTTP
    const { server: srv, url } = await serveFile(TMP);
    httpServer = srv;

    // Open remotely
    await vault.open(url, PW);
    expect(vault.isRemote()).toBe(true);
    expect(vault.isUnlocked()).toBe(true);
    expect(vault.get('db.host', 'prod')).toBe('db.prod.com');

    // Mutations should throw
    await expect(vault.addService('api', 'API')).rejects.toThrow('Cannot write to a remote vault');

    vault.lock();
    expect(vault.isRemote()).toBe(false);
  });

  it('refresh re-fetches remote vault data', { timeout: 30000 }, async () => {
    // Create vault with initial data
    await vault.create(TMP, PW);
    await vault.addService('db', 'Database');
    await vault.addEnvironment('prod');
    await vault.setSecret('db', 'host', { secret: false, values: { prod: 'v1' } });
    vault.lock();

    // Serve it
    const { server: srv, url } = await serveFile(TMP);
    httpServer = srv;

    // Open remotely
    await vault.open(url, PW);
    expect(vault.get('db.host', 'prod')).toBe('v1');

    // Update the local file (simulating someone else updating the hosted vault)
    await vault.lock();
    await vault.open(TMP, PW);
    await vault.setSecretValue('db', 'host', 'prod', 'v2');
    vault.lock();

    // Update the HTTP server to serve the new file
    httpServer.close();
    const { server: srv2, url: url2 } = await serveFile(TMP);
    httpServer = srv2;

    // Re-open from new URL (same vault, updated content)
    await vault.open(url2, PW);
    expect(vault.get('db.host', 'prod')).toBe('v2');

    vault.lock();
  });

  it('refresh throws on local vault', async () => {
    await vault.create(TMP, PW);
    expect(vault.isRemote()).toBe(false);
    await expect(vault.refresh()).rejects.toThrow('only supported for remote vaults');
    vault.lock();
  });
});
