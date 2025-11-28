# Network Scanner Usermod

This usermod scans the local network for active devices using TCP connection attempts to common ports (HTTP, HTTPS, SSH). It provides a simple network discovery feature that can be useful for:

- Identifying devices on your local network
- Monitoring network activity
- Debugging network connectivity issues

## Features

- **Network Scanning**: Scans a configurable IP range on the local subnet
- **Device Discovery**: Identifies active devices by attempting TCP connections
- **Web UI Integration**: Displays discovered devices in the WLED info section
- **JSON API**: Provides scan results via the WLED JSON API
- **Manual Scan Trigger**: Start a scan on-demand via the web UI or API
- **Configurable Settings**: Adjust scan interval, IP range, and enable/disable the usermod

## How It Works

The usermod uses TCP connection attempts to common ports (80, 443, 22) to detect active devices on the network. This approach is more reliable on ESP32 devices compared to raw ICMP ping, as many routers and devices respond to TCP connections.

The scan is performed non-blocking, processing one IP address per loop iteration to avoid blocking the main WLED functionality.

## Installation

### Method 1: Manual Installation

1. Copy `usermod_network_scanner.h` to the `wled00` folder
2. Open `usermods_list.cpp` and add:
   ```cpp
   #include "usermod_network_scanner.h"
   ```
   at the top of the file, and:
   ```cpp
   registerUsermod(new NetworkScannerUsermod());
   ```
   in the `registerUsermods()` function.

3. Add the usermod ID to `const.h` (find the usermod ID section):
   ```cpp
   #define USERMOD_ID_NETWORK_SCANNER   45   //Usermod "usermod_network_scanner.h"
   ```

### Method 2: Using platformio_override.ini

Create or edit `platformio_override.ini` to include:

```ini
[env:network_scanner]
extends = env:esp32dev
build_flags = ${env:esp32dev.build_flags}
  -D USERMOD_NETWORK_SCANNER
lib_deps = ${env:esp32dev.lib_deps}
```

## Configuration

Settings can be adjusted in the WLED Usermod Settings page (`/settings/um`):

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| enabled | Enable/disable the usermod | true | true/false |
| scan-interval-s | Time between automatic scans (seconds) | 300 | 60-3600 |
| scan-start-ip | Start of IP range to scan (last octet) | 1 | 1-254 |
| scan-end-ip | End of IP range to scan (last octet) | 254 | 1-254 |

## JSON API

### State Object (`/json/state`)

The usermod adds the following to the state object:

```json
{
  "Network Scanner": {
    "scanning": false,
    "deviceCount": 5,
    "lastScanDuration": 45000,
    "devices": [
      "192.168.1.1",
      "192.168.1.10",
      "192.168.1.15",
      "192.168.1.100",
      "192.168.1.150"
    ]
  }
}
```

### Triggering a Scan

To trigger a manual scan, send a POST request to `/json/state`:

```json
{
  "Network Scanner": {
    "scan": true
  }
}
```

Or use the "Scan Now" button in the WLED info page.

## Web UI

The usermod displays the following in the Info section:

- **Network Scanner**: Shows device count or scan progress
- **Scan Duration**: Time taken for the last scan
- **Scan Now Button**: Trigger a manual scan

## Compile-time Options

You can customize the following defines before including the usermod:

```cpp
// Maximum number of devices to track (default: 32)
#define NETWORK_SCANNER_MAX_DEVICES 32

// Default scan interval in milliseconds (default: 300000 = 5 minutes)
#define NETWORK_SCANNER_DEFAULT_INTERVAL 300000

// TCP connection timeout in milliseconds (default: 100)
#define NETWORK_SCANNER_PING_TIMEOUT 100
```

## Notes

- The scan is non-blocking and processes one IP per loop iteration
- TCP connections to ports 80, 443, and 22 are attempted
- The usermod skips the device's own IP address during scanning
- A full subnet scan (254 addresses) can take several minutes depending on timeout settings
- For faster scans, reduce the IP range to only the addresses you expect to find devices at

## Compatibility

- ESP32: Full support
- ESP8266: Supported but may have memory constraints with large device lists

## Memory Usage

- Each tracked device uses 1 byte (last octet of IP)
- Default maximum of 32 devices = ~32 bytes for device storage
- Additional flash memory for code and strings

## Author

WLED Community Usermod

## License

MIT License (same as WLED)
