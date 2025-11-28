#pragma once

#include "wled.h"

/*
 * Network Scanner Usermod
 * 
 * This usermod scans the local network for active devices using ICMP ping.
 * It displays the discovered devices in the WLED web UI info section
 * and provides the results via the JSON API.
 * 
 * Features:
 * - Scans configurable IP range on the local subnet
 * - Displays count of active devices
 * - Lists discovered IP addresses
 * - Configurable scan interval and range
 * - Manual scan trigger via API
 * 
 * Usage:
 * 1. Copy this file to the wled00 folder
 * 2. Add #include "usermod_network_scanner.h" to usermods_list.cpp
 * 3. Add registerUsermod(new NetworkScannerUsermod()); to usermods_list.cpp
 */

// Maximum number of devices to track
#ifndef NETWORK_SCANNER_MAX_DEVICES
  #define NETWORK_SCANNER_MAX_DEVICES 32
#endif

// Default scan interval in milliseconds (5 minutes)
#ifndef NETWORK_SCANNER_DEFAULT_INTERVAL
  #define NETWORK_SCANNER_DEFAULT_INTERVAL 300000
#endif

// Ping timeout in milliseconds
#ifndef NETWORK_SCANNER_PING_TIMEOUT
  #define NETWORK_SCANNER_PING_TIMEOUT 100
#endif

class NetworkScannerUsermod : public Usermod {

  private:
    bool enabled = true;
    bool initDone = false;
    bool scanInProgress = false;
    bool scanRequested = false;
    
    // Scan settings
    unsigned long scanIntervalMs = NETWORK_SCANNER_DEFAULT_INTERVAL;
    unsigned long lastScanTime = 0;
    uint8_t scanStartIP = 1;      // Start of IP range to scan (last octet)
    uint8_t scanEndIP = 254;      // End of IP range to scan (last octet)
    
    // Current scan state
    uint8_t currentScanIP = 0;
    
    // Results storage
    uint8_t activeDevices[NETWORK_SCANNER_MAX_DEVICES];
    uint8_t activeDeviceCount = 0;
    unsigned long lastScanDuration = 0;
    unsigned long scanStartTime = 0;
    
    // Strings to reduce flash memory usage
    static const char _name[];
    static const char _enabled[];
    static const char _scanInterval[];
    static const char _scanStart[];
    static const char _scanEnd[];

    // WiFi client for TCP ping (more reliable than ICMP on ESP32)
    WiFiClient pingClient;

    /**
     * Attempt to check if a host is reachable
     * Uses TCP connection attempt to common ports as ESP32 doesn't have native ICMP
     */
    bool isHostReachable(IPAddress ip) {
      // Try TCP connection to port 80 (HTTP) or 443 (HTTPS) with short timeout
      pingClient.setTimeout(NETWORK_SCANNER_PING_TIMEOUT);
      
      // Try HTTP port first
      if (pingClient.connect(ip, 80)) {
        pingClient.stop();
        return true;
      }
      
      // Try HTTPS port
      if (pingClient.connect(ip, 443)) {
        pingClient.stop();
        return true;
      }
      
      // Try SSH port (common on many devices)
      if (pingClient.connect(ip, 22)) {
        pingClient.stop();
        return true;
      }
      
      return false;
    }

    /**
     * Get the base IP address of the local network (first 3 octets)
     */
    IPAddress getNetworkBase() {
      IPAddress localIP = Network.localIP();
      return IPAddress(localIP[0], localIP[1], localIP[2], 0);
    }

    /**
     * Process one step of the network scan
     * Returns true if scan is still in progress, false if complete
     */
    bool processScanStep() {
      if (!scanInProgress) return false;
      
      IPAddress baseIP = getNetworkBase();
      IPAddress targetIP(baseIP[0], baseIP[1], baseIP[2], currentScanIP);
      
      // Skip our own IP
      IPAddress localIP = Network.localIP();
      if (currentScanIP != localIP[3]) {
        if (isHostReachable(targetIP)) {
          if (activeDeviceCount < NETWORK_SCANNER_MAX_DEVICES) {
            activeDevices[activeDeviceCount++] = currentScanIP;
            DEBUG_PRINT(F("Network Scanner: Found device at "));
            DEBUG_PRINTLN(targetIP.toString());
          }
        }
      }
      
      currentScanIP++;
      
      // Check if scan is complete
      if (currentScanIP > scanEndIP) {
        scanInProgress = false;
        lastScanDuration = millis() - scanStartTime;
        DEBUG_PRINT(F("Network Scanner: Scan complete. Found "));
        DEBUG_PRINT(activeDeviceCount);
        DEBUG_PRINTLN(F(" devices"));
        return false;
      }
      
      return true;
    }

    /**
     * Start a new network scan
     */
    void startScan() {
      if (!WLED_CONNECTED || scanInProgress) return;
      
      DEBUG_PRINTLN(F("Network Scanner: Starting scan..."));
      
      // Reset results
      activeDeviceCount = 0;
      memset(activeDevices, 0, sizeof(activeDevices));
      
      // Initialize scan
      currentScanIP = scanStartIP;
      scanStartTime = millis();
      scanInProgress = true;
      lastScanTime = millis();
    }

  public:

    /**
     * Enable/Disable the usermod
     */
    inline void enable(bool enable) { enabled = enable; }
    
    /**
     * Get usermod enabled/disabled state
     */
    inline bool isEnabled() { return enabled; }
    
    /**
     * Check if scan is currently running
     */
    inline bool isScanning() { return scanInProgress; }
    
    /**
     * Get count of discovered devices
     */
    inline uint8_t getDeviceCount() { return activeDeviceCount; }
    
    /**
     * Trigger a manual scan
     */
    void triggerScan() { scanRequested = true; }

    /**
     * setup() is called once at boot. WiFi is not yet connected at this point.
     */
    void setup() {
      initDone = true;
      DEBUG_PRINTLN(F("Network Scanner: Initialized"));
    }

    /**
     * connected() is called every time the WiFi is (re)connected
     */
    void connected() {
      DEBUG_PRINTLN(F("Network Scanner: WiFi connected"));
      // Trigger initial scan after connection
      scanRequested = true;
    }

    /**
     * loop() is called continuously
     */
    void loop() {
      if (!enabled || !initDone) return;
      if (!WLED_CONNECTED) return;
      if (strip.isUpdating()) return;
      
      // Check if manual scan was requested
      if (scanRequested && !scanInProgress) {
        scanRequested = false;
        startScan();
      }
      
      // Check if automatic scan should start
      if (!scanInProgress && (millis() - lastScanTime > scanIntervalMs)) {
        startScan();
      }
      
      // Process scan if in progress (one IP per loop iteration to avoid blocking)
      if (scanInProgress) {
        processScanStep();
      }
    }

    /**
     * addToJsonInfo() adds custom entries to the /json/info part of the JSON API
     */
    void addToJsonInfo(JsonObject& root) {
      if (!enabled) return;

      JsonObject user = root["u"];
      if (user.isNull()) user = root.createNestedObject("u");

      // Show scan status and device count
      JsonArray scanInfo = user.createNestedArray(FPSTR(_name));
      
      if (scanInProgress) {
        String progress = "Scanning... ";
        progress += String(currentScanIP - scanStartIP);
        progress += "/";
        progress += String(scanEndIP - scanStartIP + 1);
        scanInfo.add(progress);
      } else {
        scanInfo.add(activeDeviceCount);
        scanInfo.add(F(" devices found"));
      }

      // Show last scan duration if available
      if (lastScanDuration > 0 && !scanInProgress) {
        JsonArray durationInfo = user.createNestedArray(F("Scan Duration"));
        durationInfo.add(lastScanDuration / 1000);
        durationInfo.add(F(" sec"));
      }

      // Add scan trigger button via HTML in info
      if (!scanInProgress) {
        String scanBtn = F("Scan Network<button class=\"btn\" onclick=\"requestJson({");
        scanBtn += FPSTR(_name);
        scanBtn += F(":{scan:true}});\">Scan Now</button>");
        JsonArray btnArr = user.createNestedArray(scanBtn);
        btnArr.add("");
      }
    }

    /**
     * addToJsonState() adds custom entries to the /json/state part of the JSON API
     */
    void addToJsonState(JsonObject& root) {
      if (!initDone || !enabled) return;

      JsonObject usermod = root[FPSTR(_name)];
      if (usermod.isNull()) usermod = root.createNestedObject(FPSTR(_name));

      usermod[F("scanning")] = scanInProgress;
      usermod[F("deviceCount")] = activeDeviceCount;
      usermod[F("lastScanDuration")] = lastScanDuration;
      
      // Add list of discovered devices
      JsonArray devices = usermod.createNestedArray(F("devices"));
      IPAddress baseIP = getNetworkBase();
      for (uint8_t i = 0; i < activeDeviceCount; i++) {
        IPAddress deviceIP(baseIP[0], baseIP[1], baseIP[2], activeDevices[i]);
        devices.add(deviceIP.toString());
      }
    }

    /**
     * readFromJsonState() receives data clients send to /json/state
     */
    void readFromJsonState(JsonObject& root) {
      if (!initDone) return;

      JsonObject usermod = root[FPSTR(_name)];
      if (!usermod.isNull()) {
        // Check for scan trigger
        if (usermod[F("scan")] == true) {
          triggerScan();
        }
      }
    }

    /**
     * addToConfig() stores persistent settings to cfg.json
     */
    void addToConfig(JsonObject& root) {
      JsonObject top = root.createNestedObject(FPSTR(_name));
      top[FPSTR(_enabled)] = enabled;
      top[FPSTR(_scanInterval)] = scanIntervalMs / 1000; // Store in seconds
      top[FPSTR(_scanStart)] = scanStartIP;
      top[FPSTR(_scanEnd)] = scanEndIP;
    }

    /**
     * readFromConfig() restores settings from cfg.json
     */
    bool readFromConfig(JsonObject& root) {
      JsonObject top = root[FPSTR(_name)];
      
      bool configComplete = !top.isNull();
      
      configComplete &= getJsonValue(top[FPSTR(_enabled)], enabled, true);
      
      uint32_t intervalSec = scanIntervalMs / 1000;
      configComplete &= getJsonValue(top[FPSTR(_scanInterval)], intervalSec, 300);
      scanIntervalMs = intervalSec * 1000;
      scanIntervalMs = max(60000UL, min(3600000UL, scanIntervalMs)); // 1 min to 1 hour
      
      configComplete &= getJsonValue(top[FPSTR(_scanStart)], scanStartIP, (uint8_t)1);
      configComplete &= getJsonValue(top[FPSTR(_scanEnd)], scanEndIP, (uint8_t)254);
      
      // Validate range
      scanStartIP = max((uint8_t)1, min((uint8_t)254, scanStartIP));
      scanEndIP = max(scanStartIP, min((uint8_t)254, scanEndIP));
      
      return configComplete;
    }

    /**
     * appendConfigData() adds additional info to the settings page
     */
    void appendConfigData() {
      oappend(SET_F("addInfo('"));
      oappend(String(FPSTR(_name)).c_str());
      oappend(SET_F(":"));
      oappend(String(FPSTR(_scanInterval)).c_str());
      oappend(SET_F("',1,'<i>seconds (60-3600)</i>');"));
      
      oappend(SET_F("addInfo('"));
      oappend(String(FPSTR(_name)).c_str());
      oappend(SET_F(":"));
      oappend(String(FPSTR(_scanStart)).c_str());
      oappend(SET_F("',1,'<i>Start IP last octet (1-254)</i>');"));
      
      oappend(SET_F("addInfo('"));
      oappend(String(FPSTR(_name)).c_str());
      oappend(SET_F(":"));
      oappend(String(FPSTR(_scanEnd)).c_str());
      oappend(SET_F("',1,'<i>End IP last octet (1-254)</i>');"));
    }

    /**
     * getId() returns unique usermod ID
     */
    uint16_t getId() {
      return USERMOD_ID_NETWORK_SCANNER;
    }
};

// Strings to reduce flash memory usage
const char NetworkScannerUsermod::_name[] PROGMEM = "Network Scanner";
const char NetworkScannerUsermod::_enabled[] PROGMEM = "enabled";
const char NetworkScannerUsermod::_scanInterval[] PROGMEM = "scan-interval-s";
const char NetworkScannerUsermod::_scanStart[] PROGMEM = "scan-start-ip";
const char NetworkScannerUsermod::_scanEnd[] PROGMEM = "scan-end-ip";
