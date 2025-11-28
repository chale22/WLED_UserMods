const net = require('net');
const os = require('os');
const http = require('http');

/**
 * Network Scanner Application
 * Scans the local network for active devices using TCP connection attempts.
 */

class NetworkScanner {
  constructor(options = {}) {
    this.timeout = options.timeout || 200;
    this.ports = options.ports || [80, 443, 22, 21, 23, 445, 139];
    this.concurrency = options.concurrency || 50;
  }

  /**
   * Get local network information
   * @returns {Object} Network info with address and subnet
   */
  getLocalNetworkInfo() {
    const interfaces = os.networkInterfaces();
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const parts = addr.address.split('.');
          const subnetParts = addr.netmask.split('.');
          
          // Calculate network base address
          const networkBase = parts.map((p, i) => 
            (parseInt(p) & parseInt(subnetParts[i])).toString()
          ).join('.');
          
          return {
            address: addr.address,
            netmask: addr.netmask,
            networkBase,
            interfaceName: name
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a specific port is open on a host
   * @param {string} host - IP address to check
   * @param {number} port - Port number to check
   * @returns {Promise<boolean>} True if port is open
   */
  checkPort(host, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(this.timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  /**
   * Check if a host is reachable on any common port
   * @param {string} host - IP address to check
   * @returns {Promise<Object|null>} Device info if reachable, null otherwise
   */
  async checkHost(host) {
    const openPorts = [];
    
    for (const port of this.ports) {
      const isOpen = await this.checkPort(host, port);
      if (isOpen) {
        openPorts.push(port);
      }
    }
    
    if (openPorts.length > 0) {
      return {
        ip: host,
        openPorts,
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }

  /**
   * Generate IP range for scanning
   * @param {string} networkBase - Network base address (e.g., "192.168.1.0")
   * @param {number} start - Start of range (1-254)
   * @param {number} end - End of range (1-254)
   * @returns {string[]} Array of IP addresses to scan
   */
  generateIPRange(networkBase, start = 1, end = 254) {
    const baseParts = networkBase.split('.');
    const basePrefix = baseParts.slice(0, 3).join('.');
    const ips = [];
    
    for (let i = start; i <= end; i++) {
      ips.push(`${basePrefix}.${i}`);
    }
    
    return ips;
  }

  /**
   * Scan a range of IP addresses with concurrency control
   * @param {string[]} ips - Array of IP addresses to scan
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object[]>} Array of discovered devices
   */
  async scanRange(ips, onProgress = null) {
    const devices = [];
    let completed = 0;
    const total = ips.length;
    
    // Process IPs in batches for concurrency control
    const processBatch = async (batch) => {
      const promises = batch.map(async (ip) => {
        const result = await this.checkHost(ip);
        completed++;
        
        if (onProgress) {
          onProgress({
            current: completed,
            total,
            percentage: Math.round((completed / total) * 100),
            currentIP: ip
          });
        }
        
        return result;
      });
      
      const results = await Promise.all(promises);
      return results.filter(r => r !== null);
    };
    
    // Split IPs into batches
    for (let i = 0; i < ips.length; i += this.concurrency) {
      const batch = ips.slice(i, i + this.concurrency);
      const batchResults = await processBatch(batch);
      devices.push(...batchResults);
    }
    
    return devices;
  }

  /**
   * Perform a full network scan
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} Scan results
   */
  async scan(options = {}) {
    const startTime = Date.now();
    
    const networkInfo = this.getLocalNetworkInfo();
    if (!networkInfo) {
      throw new Error('Could not determine local network information');
    }
    
    const startIP = options.startIP || 1;
    const endIP = options.endIP || 254;
    const onProgress = options.onProgress || null;
    
    console.log(`\nNetwork Scanner`);
    console.log(`===============`);
    console.log(`Local IP: ${networkInfo.address}`);
    console.log(`Network: ${networkInfo.networkBase}`);
    console.log(`Interface: ${networkInfo.interfaceName}`);
    console.log(`Scanning range: ${startIP} - ${endIP}`);
    console.log(`Ports: ${this.ports.join(', ')}`);
    console.log(`Timeout: ${this.timeout}ms`);
    console.log(`Concurrency: ${this.concurrency}`);
    console.log(`\nScanning...`);
    
    const ips = this.generateIPRange(networkInfo.networkBase, startIP, endIP);
    
    // Filter out our own IP
    const filteredIPs = ips.filter(ip => ip !== networkInfo.address);
    
    const devices = await this.scanRange(filteredIPs, (progress) => {
      if (onProgress) {
        onProgress(progress);
      }
      // Simple progress bar
      process.stdout.write(`\rProgress: ${progress.percentage}% (${progress.current}/${progress.total}) - Current: ${progress.currentIP}    `);
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\n\nScan Complete!`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Devices found: ${devices.length}`);
    
    return {
      networkInfo,
      devices,
      scanDuration: duration,
      scanRange: { start: startIP, end: endIP },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Simple HTTP server for web interface
 */
class ScannerServer {
  constructor(scanner, port = 3000) {
    this.scanner = scanner;
    this.port = port;
    this.lastScanResult = null;
    this.isScanning = false;
  }

  getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Network Scanner</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #1a1a2e;
      color: #eee;
    }
    h1 { color: #00d4ff; margin-bottom: 30px; }
    .card {
      background: #16213e;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .card h2 { margin-top: 0; color: #00d4ff; font-size: 1.2em; }
    .btn {
      background: #00d4ff;
      color: #1a1a2e;
      border: none;
      padding: 12px 24px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s;
    }
    .btn:hover { background: #00a8cc; }
    .btn:disabled { background: #666; cursor: not-allowed; }
    .device {
      background: #0f3460;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
      border-left: 4px solid #00d4ff;
    }
    .device-ip { font-size: 1.2em; font-weight: bold; color: #00d4ff; }
    .device-ports { color: #aaa; font-size: 0.9em; margin-top: 5px; }
    .progress-bar {
      height: 20px;
      background: #0f3460;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d4ff, #00a8cc);
      transition: width 0.3s;
    }
    .stats { display: flex; gap: 20px; flex-wrap: wrap; }
    .stat {
      background: #0f3460;
      padding: 15px;
      border-radius: 8px;
      flex: 1;
      min-width: 150px;
    }
    .stat-value { font-size: 1.5em; color: #00d4ff; font-weight: bold; }
    .stat-label { color: #aaa; font-size: 0.9em; }
    .config { display: flex; gap: 15px; flex-wrap: wrap; align-items: center; margin-bottom: 15px; }
    .config input {
      padding: 10px;
      border: 1px solid #0f3460;
      border-radius: 5px;
      background: #0f3460;
      color: #eee;
      width: 80px;
    }
    .config label { color: #aaa; }
    #status { color: #00d4ff; margin-left: 15px; }
    .no-devices { color: #aaa; font-style: italic; }
  </style>
</head>
<body>
  <h1>🔍 Network Scanner</h1>
  
  <div class="card">
    <h2>Scan Configuration</h2>
    <div class="config">
      <label>Start IP: <input type="number" id="startIP" min="1" max="254" value="1"></label>
      <label>End IP: <input type="number" id="endIP" min="1" max="254" value="254"></label>
      <button class="btn" id="scanBtn" onclick="startScan()">Start Scan</button>
      <span id="status"></span>
    </div>
    <div class="progress-bar" id="progressBar" style="display:none;">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
  </div>

  <div class="card" id="resultsCard" style="display:none;">
    <h2>Scan Results</h2>
    <div class="stats" id="stats"></div>
    <h3 style="margin-top: 20px;">Discovered Devices</h3>
    <div id="devices"></div>
  </div>

  <script>
    let scanning = false;
    
    async function startScan() {
      if (scanning) return;
      
      const startIP = parseInt(document.getElementById('startIP').value);
      const endIP = parseInt(document.getElementById('endIP').value);
      
      if (startIP < 1 || startIP > 254 || endIP < 1 || endIP > 254 || startIP > endIP) {
        alert('Invalid IP range. Please enter values between 1 and 254.');
        return;
      }
      
      scanning = true;
      document.getElementById('scanBtn').disabled = true;
      document.getElementById('progressBar').style.display = 'block';
      document.getElementById('status').textContent = 'Scanning...';
      document.getElementById('resultsCard').style.display = 'none';
      
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startIP, endIP })
        });
        
        const result = await response.json();
        displayResults(result);
      } catch (error) {
        document.getElementById('status').textContent = 'Error: ' + error.message;
      } finally {
        scanning = false;
        document.getElementById('scanBtn').disabled = false;
        document.getElementById('progressBar').style.display = 'none';
        document.getElementById('status').textContent = '';
      }
    }
    
    function displayResults(result) {
      document.getElementById('resultsCard').style.display = 'block';
      
      document.getElementById('stats').innerHTML = 
        '<div class="stat"><div class="stat-value">' + result.devices.length + '</div><div class="stat-label">Devices Found</div></div>' +
        '<div class="stat"><div class="stat-value">' + result.scanDuration.toFixed(2) + 's</div><div class="stat-label">Scan Duration</div></div>' +
        '<div class="stat"><div class="stat-value">' + result.networkInfo.address + '</div><div class="stat-label">Your IP</div></div>' +
        '<div class="stat"><div class="stat-value">' + result.scanRange.start + '-' + result.scanRange.end + '</div><div class="stat-label">IP Range</div></div>';
      
      const devicesDiv = document.getElementById('devices');
      if (result.devices.length === 0) {
        devicesDiv.innerHTML = '<p class="no-devices">No devices found in the specified range.</p>';
      } else {
        devicesDiv.innerHTML = result.devices.map(device => 
          '<div class="device">' +
            '<div class="device-ip">' + device.ip + '</div>' +
            '<div class="device-ports">Open ports: ' + device.openPorts.join(', ') + '</div>' +
          '</div>'
        ).join('');
      }
    }
    
    // Poll for progress updates during scan
    async function pollProgress() {
      if (!scanning) return;
      
      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        
        if (status.isScanning && status.progress) {
          document.getElementById('progressFill').style.width = status.progress.percentage + '%';
        }
      } catch (e) {}
      
      if (scanning) {
        setTimeout(pollProgress, 500);
      }
    }
  </script>
</body>
</html>`;
  }

  start() {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      
      // Serve HTML
      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.getHTML());
        return;
      }
      
      // API: Start scan
      if (url.pathname === '/api/scan' && req.method === 'POST') {
        if (this.isScanning) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Scan already in progress' }));
          return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const options = body ? JSON.parse(body) : {};
            this.isScanning = true;
            this.scanProgress = { percentage: 0 };
            
            const result = await this.scanner.scan({
              startIP: options.startIP || 1,
              endIP: options.endIP || 254,
              onProgress: (progress) => {
                this.scanProgress = progress;
              }
            });
            
            this.lastScanResult = result;
            this.isScanning = false;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            this.isScanning = false;
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }
      
      // API: Get status
      if (url.pathname === '/api/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          isScanning: this.isScanning,
          progress: this.scanProgress || null,
          lastResult: this.lastScanResult
        }));
        return;
      }
      
      // API: Get last results
      if (url.pathname === '/api/results' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.lastScanResult || { error: 'No scan results available' }));
        return;
      }
      
      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    server.listen(this.port, () => {
      console.log(`\n🌐 Web interface available at: http://localhost:${this.port}`);
      console.log(`📡 API endpoints:`);
      console.log(`   POST /api/scan - Start a network scan`);
      console.log(`   GET  /api/status - Get scan status`);
      console.log(`   GET  /api/results - Get last scan results\n`);
    });
    
    return server;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  const scanner = new NetworkScanner({
    timeout: 200,
    concurrency: 50,
    ports: [80, 443, 22, 21, 23, 445, 139, 8080, 3000]
  });
  
  // Check for --server flag
  if (args.includes('--server') || args.includes('-s')) {
    const portIndex = args.indexOf('--port');
    const port = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 3000;
    
    const server = new ScannerServer(scanner, port);
    server.start();
    return;
  }
  
  // CLI mode - run scan directly
  const startIP = args[0] ? parseInt(args[0]) : 1;
  const endIP = args[1] ? parseInt(args[1]) : 254;
  
  try {
    const result = await scanner.scan({ startIP, endIP });
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log('Discovered Devices:');
    console.log('─'.repeat(50));
    
    if (result.devices.length === 0) {
      console.log('No devices found.');
    } else {
      result.devices.forEach((device, index) => {
        console.log(`\n${index + 1}. ${device.ip}`);
        console.log(`   Open ports: ${device.openPorts.join(', ')}`);
      });
    }
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Total devices: ${result.devices.length}`);
    console.log(`Scan completed in ${result.scanDuration.toFixed(2)} seconds`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export for testing
module.exports = { NetworkScanner, ScannerServer };

// Run if called directly
if (require.main === module) {
  main();
}
