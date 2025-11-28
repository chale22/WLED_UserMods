# Network Scanner

A fast and efficient network scanner application that discovers devices on your local network using TCP connection probing.

## Features

- 🔍 **Device Discovery**: Scans IP ranges to find active devices on your network
- 🚀 **Fast Scanning**: Concurrent scanning with configurable parallelism
- 🌐 **Web Interface**: Beautiful web UI for easy network scanning
- 📡 **REST API**: Full API for integration with other tools
- 🖥️ **CLI Mode**: Command-line interface for scripting and automation
- 🔌 **Port Detection**: Identifies open ports on discovered devices

## Installation

```bash
cd network-scanner
npm install
```

## Usage

### Web Interface (Recommended)

Start the web server:

```bash
npm start -- --server
```

Then open your browser to `http://localhost:3000`

You can specify a custom port:

```bash
npm start -- --server --port 8080
```

### Command Line Interface

Scan the full subnet (1-254):

```bash
npm start
```

Scan a specific range:

```bash
npm start 1 50     # Scan IPs 1-50
npm start 100 200  # Scan IPs 100-200
```

## API Endpoints

When running in server mode, the following API endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web interface |
| `/api/scan` | POST | Start a network scan |
| `/api/status` | GET | Get current scan status |
| `/api/results` | GET | Get last scan results |

### Start a Scan

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"startIP": 1, "endIP": 254}'
```

### Get Scan Status

```bash
curl http://localhost:3000/api/status
```

### Get Results

```bash
curl http://localhost:3000/api/results
```

## Example Output

### CLI Output

```
Network Scanner
===============
Local IP: 192.168.1.100
Network: 192.168.1.0
Interface: eth0
Scanning range: 1 - 254
Ports: 80, 443, 22, 21, 23, 445, 139
Timeout: 200ms
Concurrency: 50

Scanning...
Progress: 100% (254/254) - Current: 192.168.1.254

Scan Complete!
Duration: 12.45 seconds
Devices found: 8

──────────────────────────────────────────────────
Discovered Devices:
──────────────────────────────────────────────────

1. 192.168.1.1
   Open ports: 80, 443

2. 192.168.1.10
   Open ports: 22, 80

3. 192.168.1.50
   Open ports: 445, 139
...
```

### API Response

```json
{
  "networkInfo": {
    "address": "192.168.1.100",
    "netmask": "255.255.255.0",
    "networkBase": "192.168.1.0",
    "interfaceName": "eth0"
  },
  "devices": [
    {
      "ip": "192.168.1.1",
      "openPorts": [80, 443],
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    {
      "ip": "192.168.1.10",
      "openPorts": [22, 80],
      "timestamp": "2024-01-15T10:30:05.000Z"
    }
  ],
  "scanDuration": 12.45,
  "scanRange": {
    "start": 1,
    "end": 254
  },
  "timestamp": "2024-01-15T10:30:15.000Z"
}
```

## Configuration

The scanner can be configured with the following options:

| Option | Default | Description |
|--------|---------|-------------|
| `timeout` | 200ms | TCP connection timeout per port |
| `concurrency` | 50 | Number of concurrent scans |
| `ports` | 80, 443, 22, 21, 23, 445, 139, 8080, 3000 | Ports to probe |

## How It Works

The network scanner uses TCP connection attempts to common ports to detect active devices. This method is reliable and works across different network configurations. Here's the process:

1. **Network Detection**: Automatically detects your local network configuration
2. **IP Generation**: Generates a list of IP addresses to scan based on your subnet
3. **Concurrent Probing**: Attempts TCP connections to common ports in parallel
4. **Result Collection**: Collects and reports all devices that respond on any port

## Scanned Ports

By default, the scanner probes these common ports:

- **80** - HTTP
- **443** - HTTPS
- **22** - SSH
- **21** - FTP
- **23** - Telnet
- **445** - SMB
- **139** - NetBIOS
- **8080** - HTTP Alternate
- **3000** - Development servers

## Requirements

- Node.js 16.0.0 or higher
- Network access to target subnet

## Security Considerations

- This tool is intended for use on networks you own or have permission to scan
- Network scanning may be detected by intrusion detection systems
- Some networks may have policies against active scanning
- Always obtain proper authorization before scanning a network

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
