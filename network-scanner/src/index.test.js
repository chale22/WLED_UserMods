const { describe, it } = require('node:test');
const assert = require('node:assert');
const { NetworkScanner } = require('./index.js');

describe('NetworkScanner', () => {
  describe('constructor', () => {
    it('should create scanner with default options', () => {
      const scanner = new NetworkScanner();
      assert.strictEqual(scanner.timeout, 200);
      assert.strictEqual(scanner.concurrency, 50);
      assert.ok(Array.isArray(scanner.ports));
    });

    it('should accept custom options', () => {
      const scanner = new NetworkScanner({
        timeout: 500,
        concurrency: 100,
        ports: [80, 443]
      });
      assert.strictEqual(scanner.timeout, 500);
      assert.strictEqual(scanner.concurrency, 100);
      assert.deepStrictEqual(scanner.ports, [80, 443]);
    });
  });

  describe('getLocalNetworkInfo', () => {
    it('should return network information object', () => {
      const scanner = new NetworkScanner();
      const info = scanner.getLocalNetworkInfo();
      
      // May return null if no non-internal IPv4 interface found
      if (info !== null) {
        assert.ok(info.address);
        assert.ok(info.netmask);
        assert.ok(info.networkBase);
        assert.ok(info.interfaceName);
      }
    });
  });

  describe('generateIPRange', () => {
    it('should generate correct IP range', () => {
      const scanner = new NetworkScanner();
      const ips = scanner.generateIPRange('192.168.1.0', 1, 5);
      
      assert.strictEqual(ips.length, 5);
      assert.strictEqual(ips[0], '192.168.1.1');
      assert.strictEqual(ips[4], '192.168.1.5');
    });

    it('should handle full range', () => {
      const scanner = new NetworkScanner();
      const ips = scanner.generateIPRange('10.0.0.0', 1, 254);
      
      assert.strictEqual(ips.length, 254);
      assert.strictEqual(ips[0], '10.0.0.1');
      assert.strictEqual(ips[253], '10.0.0.254');
    });

    it('should handle single IP range', () => {
      const scanner = new NetworkScanner();
      const ips = scanner.generateIPRange('172.16.0.0', 100, 100);
      
      assert.strictEqual(ips.length, 1);
      assert.strictEqual(ips[0], '172.16.0.100');
    });
  });

  describe('checkPort', () => {
    it('should return false for non-existent host', async () => {
      const scanner = new NetworkScanner({ timeout: 100 });
      // Use a non-routable IP address
      const result = await scanner.checkPort('192.0.2.1', 80);
      assert.strictEqual(result, false);
    });

    it('should timeout appropriately', async () => {
      const scanner = new NetworkScanner({ timeout: 50 });
      const startTime = Date.now();
      await scanner.checkPort('192.0.2.1', 80);
      const elapsed = Date.now() - startTime;
      
      // Should complete within reasonable time (timeout + some overhead)
      assert.ok(elapsed < 200, `Expected timeout around 50ms, got ${elapsed}ms`);
    });
  });
});
