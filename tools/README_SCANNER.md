# WLED Controller Scanner

A standalone web application for discovering and managing WLED controllers on your network.

## Features

- 🔍 **IP Range Scanning**: Scan single IPs or entire ranges to discover WLED devices
- 🌐 **Device Information**: View detailed information about each controller including version, LED count, uptime, and memory
- ⚡ **Fast Concurrent Scanning**: Configurable concurrent scans for quick discovery
- 💾 **Export Results**: Save discovered controllers to JSON for later use
- 🎨 **Modern UI**: Clean, responsive interface with dark theme
- 🔄 **Live Updates**: Refresh individual controllers to check status

## Usage

### Opening the Scanner

1. Open `wled_scanner.htm` in any modern web browser (Chrome, Firefox, Edge, Safari)
2. The scanner works entirely in your browser - no server required!

### Scanning for Controllers

1. **Enter IP Address or Range**:
   - Single IP: `192.168.1.100`
   - IP Range: `192.168.1.1-254`
   
2. **Adjust Settings** (optional):
   - **Timeout**: How long to wait for each device (default: 2000ms)
   - **Concurrent Scans**: How many IPs to scan simultaneously (default: 10)

3. **Click "Start Scan"** to begin discovering devices

### Managing Controllers

Once controllers are discovered, you can:

- **Open UI**: Click to open the controller's web interface in a new tab
- **Refresh**: Check if the controller is still online and update its information
- **Remove**: Remove a controller from the list
- **Export**: Save all discovered controllers to a JSON file

## Browser Compatibility

This scanner works with:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

**Important**: For best results, open this file directly from your local filesystem (`file://`) or serve it over HTTP (not HTTPS). 

**Note**: Due to browser security restrictions:
- When served over HTTPS, browsers will block HTTP requests to WLED controllers (mixed content)
- WLED controllers typically only support HTTP on local networks
- Opening as a local file (`file://`) or from HTTP works best
- Ensure WLED controllers allow CORS requests (enabled by default)

## CORS Configuration

For the scanner to work properly, WLED devices should have CORS enabled. This is typically enabled by default in WLED firmware.

If you encounter CORS errors:
1. Check your WLED settings under "WiFi Setup" → "Other Settings"
2. Ensure "Enable CORS" is checked
3. Restart your WLED device

## How It Works

The scanner:
1. Parses your IP input into a list of addresses to check
2. Sends HTTP requests to `http://<ip>/json/info` for each address
3. Validates responses to confirm they're WLED devices
4. Displays discovered controllers with their information
5. Performs scans in concurrent batches for efficiency

## Technical Details

- **Pure HTML/CSS/JavaScript**: No dependencies, frameworks, or build tools required
- **Async/Await**: Modern JavaScript for efficient asynchronous scanning
- **Fetch API**: Uses browser's native fetch for HTTP requests
- **AbortController**: Implements proper timeout handling

## Limitations

- Cannot perform automatic network discovery (UDP broadcast) due to browser security
- Must manually specify IP addresses or ranges to scan
- Requires CORS to be enabled on WLED devices
- Cannot scan across different networks/subnets without direct access

## Tips

1. **Start Small**: Test with a small range first (e.g., `192.168.1.1-10`) before scanning larger ranges
2. **Adjust Timeout**: If your network is slow, increase the timeout value
3. **Reduce Concurrent Scans**: If experiencing issues, try reducing concurrent scans to 5 or less
4. **Bookmark Controllers**: After finding your controllers, export the results for future reference
5. **Network Scan**: For a typical home network, try `192.168.1.1-254` or `192.168.0.1-254`

## Examples

### Scan a single IP
```
192.168.1.100
```

### Scan a small range
```
192.168.1.50-60
```

### Scan entire subnet
```
192.168.1.1-254
```

### Different subnet
```
10.0.0.1-255
```

## Troubleshooting

**No controllers found?**
- Verify your WLED devices are powered on and connected to the network
- Check that you're using the correct IP range
- Try increasing the timeout value
- Ensure CORS is enabled on your WLED devices

**Slow scanning?**
- Reduce concurrent scans
- Increase timeout for slower networks
- Scan smaller ranges at a time

**CORS errors?**
- Check WLED CORS settings
- Ensure devices are on the same network
- Try accessing from the same device that hosts your WLED controllers

## License

This tool is part of the WLED project and is licensed under the MIT license.
