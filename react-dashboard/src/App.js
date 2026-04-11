import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  
  const SENSOR_API_ENDPOINT = 'https://8g9i1kbzd0.execute-api.eu-north-1.amazonaws.com/production/sensors';
  const GET_DEVICES_ENDPOINT = 'https://sqpj2mn1il.execute-api.eu-north-1.amazonaws.com/default/iot-get-all-devices'; 

  
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [devicesLoading, setDevicesLoading] = useState(true);


  useEffect(() => {
    fetchDeviceList();
  }, []);

  const fetchDeviceList = async () => {
    try {
      setDevicesLoading(true);
      setError(null);

      const response = await axios.get(GET_DEVICES_ENDPOINT);
      const devices = response.data.devices;

      if (devices && devices.length > 0) {
        setAvailableDevices(devices);
        
        setSelectedDevice(devices[0]);
      } else {
        setError('No devices found in database. Make sure your device has sent data.');
      }

      setDevicesLoading(false);
    } catch (err) {
      console.error('Error fetching device list:', err);
      setError('Failed to fetch device list. Check your GET_DEVICES_ENDPOINT URL.');
      setDevicesLoading(false);
    }
  };

  const fetchData = async () => {
    if (!selectedDevice) return;

    try {
      setLoading(true);
      setError(null);

      
      const response = await axios.get(
        `${SENSOR_API_ENDPOINT}?device_id=${selectedDevice}`
      );
      const data = response.data;

      setCurrentData(data);
      setLastUpdate(new Date());

      
      setChartData((prevData) => {
        const newData = [...prevData];
        const timestamp = new Date(data.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        newData.push({
          time: timestamp,
          temperature: parseFloat(data.temperature),
          humidity: parseFloat(data.humidity),
        });

        
        if (newData.length > 24) {
          newData.shift();
        }

        return newData;
      });

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch sensor data. Check your SENSOR_API_ENDPOINT URL.');
      setLoading(false);
    }
  };


  useEffect(() => {
    if (selectedDevice) {
      fetchData();

      
      const interval = setInterval(fetchData, 15000);

      
      return () => clearInterval(interval);
    }
  }, [selectedDevice]);


  const isDeviceOnline = () => {
    if (!lastUpdate) return false;
    const timeDiff = new Date() - lastUpdate;
    return timeDiff < 60000; 
  };

  const getTemperatureColor = (temp) => {
    if (temp < 10) return '#3498db'; 
    if (temp < 20) return '#2ecc71'; 
    if (temp < 30) return '#f39c12'; 
    return '#e74c3c'; 
  };


  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>📊 IoT Dashboard</h1>
            <p>Real-time Multi-Device Sensor Monitoring</p>
          </div>
          <button className="refresh-btn" onClick={fetchData} disabled={loading || !selectedDevice}>
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>

        
        {!devicesLoading && availableDevices.length > 0 && (
          <div className="device-selector">
            <label htmlFor="device-dropdown">📱 Select Device:</label>
            <select
              id="device-dropdown"
              value={selectedDevice || ''}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="device-dropdown"
            >
              <option value="">-- Choose a device --</option>
              {availableDevices.map((device) => (
                <option key={device} value={device}>
                  {device}
                </option>
              ))}
            </select>
            <span className="device-count">
              ({availableDevices.length} device{availableDevices.length !== 1 ? 's' : ''} found)
            </span>
          </div>
        )}

        
        {devicesLoading && (
          <div className="device-selector">
            <p className="loading-text">Loading devices...</p>
          </div>
        )}

        
        {!devicesLoading && availableDevices.length === 0 && (
          <div className="device-selector">
            <p className="no-devices">
              ⚠️ No devices found. Make sure your IoT device has sent data to DynamoDB.
            </p>
          </div>
        )}
      </header>

      {error && <div className="error-message">{error}</div>}

      {loading && !currentData && selectedDevice && (
        <div className="loading-container">
          <p>Loading data for {selectedDevice}...</p>
        </div>
      )}

      {currentData && selectedDevice && !loading && (
        <>
          <div className="metrics-grid">
            {/* Temperature Card */}
            <div className="metric-card temperature-card">
              <h3>🌡️ Temperature</h3>
              <div
                className="metric-value"
                style={{ color: getTemperatureColor(currentData.temperature) }}
              >
                {currentData.temperature}°C
              </div>
              <p className="metric-label">
                {currentData.temperature < 15 && 'Cold'}
                {currentData.temperature >= 15 && currentData.temperature < 25 && 'Comfortable'}
                {currentData.temperature >= 25 && 'Warm'}
              </p>
            </div>

            {/* Humidity Card */}
            <div className="metric-card humidity-card">
              <h3>💧 Humidity</h3>
              <div className="metric-value">{currentData.humidity}%</div>
              <p className="metric-label">
                {currentData.humidity < 30 && 'Dry'}
                {currentData.humidity >= 30 && currentData.humidity < 60 && 'Normal'}
                {currentData.humidity >= 60 && 'Humid'}
              </p>
            </div>

            {/* Device Status Card */}
            <div className="metric-card status-card">
              <h3>📡 Device Status</h3>
              <div className="metric-value device-name">{selectedDevice}</div>
              <div className={`status-badge ${isDeviceOnline() ? 'online' : 'offline'}`}>
                {isDeviceOnline() ? '🟢 Online' : '🔴 Offline'}
              </div>
            </div>

            {/* Signal Strength Card */}
            <div className="metric-card signal-card">
              <h3>📶 Signal Strength</h3>
              <div className="metric-value">{currentData.rssi}</div>
              <p className="metric-label">dBm</p>
            </div>

            {/* LED Status Card */}
            <div className="metric-card led-card">
              <h3>💡 LED Status</h3>
              <div className={`metric-value ${currentData.led === 'ON' ? 'led-on' : 'led-off'}`}>
                {currentData.led}
              </div>
              <p className="metric-label">
                {currentData.led === 'ON' ? 'Light is on' : 'Light is off'}
              </p>
            </div>

            {/* Uptime Card */}
            <div className="metric-card uptime-card">
              <h3>⏱️ Uptime</h3>
              <div className="metric-value">
                {Math.floor(currentData.uptime / 1000 / 60)}
              </div>
              <p className="metric-label">minutes</p>
            </div>
          </div>

          <footer className="footer">
            <p>
              Last update: {lastUpdate?.toLocaleTimeString()}
            </p>
            <p className="system-info">
              🚀 ESP32 → MQTT → AWS IoT Core → Lambda → DynamoDB
            </p>
          </footer>
        </>
      )}

      {!selectedDevice && availableDevices.length > 0 && (
        <div className="loading-container">
          <p>Please select a device from the dropdown above</p>
        </div>
      )}
    </div>
  );
}

export default App;