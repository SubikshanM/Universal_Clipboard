import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Devices.css';

export default function Devices({ socket }) {
  const { token } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://universal-clipboard-q6po.onrender.com/api/devices';
  const devicesUrl = API_BASE_URL.replace(/\/api\/(clipboard|auth).*$/, '/api/devices');

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(devicesUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data.devices);
      setError(null);
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDevices();
    }
  }, [token]);

  // Listen for device updates via Socket.IO
  useEffect(() => {
    if (socket) {
      socket.on('devices-updated', () => {
        console.log('[Devices] Received devices-updated event');
        fetchDevices();
      });

      return () => {
        socket.off('devices-updated');
      };
    }
  }, [socket]);

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to remove this device?')) return;

    try {
      await axios.delete(`${devicesUrl}/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDevices();
    } catch (err) {
      console.error('Error deleting device:', err);
      alert('Failed to delete device');
    }
  };

  const handleRenameDevice = async (deviceId, currentName) => {
    const newName = prompt('Enter new device name:', currentName);
    if (!newName || newName === currentName) return;

    try {
      await axios.put(`${devicesUrl}/${deviceId}/rename`, 
        { deviceName: newName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchDevices();
    } catch (err) {
      console.error('Error renaming device:', err);
      alert('Failed to rename device');
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '💻';
    }
  };

  const onlineDevices = devices.filter(d => d.is_online);
  const offlineDevices = devices.filter(d => !d.is_online);

  if (loading) {
    return <div className="devices-container"><p>Loading devices...</p></div>;
  }

  return (
    <div className="devices-container">
      <h2 className="devices-title">Connected Devices</h2>
      
      {error && <div className="devices-error">{error}</div>}

      <div className="devices-section">
        <h3 className="devices-section-title">
          Online Now <span className="devices-count">{onlineDevices.length}</span>
        </h3>
        {onlineDevices.length === 0 ? (
          <p className="devices-empty">No devices online</p>
        ) : (
          <div className="devices-list">
            {onlineDevices.map(device => (
              <div key={device.id} className="device-card online">
                <div className="device-header">
                  <span className="device-icon">{getDeviceIcon(device.device_type)}</span>
                  <div className="device-info">
                    <h4 className="device-name">{device.device_name}</h4>
                    <p className="device-details">
                      {device.browser} • {device.os}
                    </p>
                  </div>
                  <span className="device-status online-badge">Online</span>
                </div>
                <div className="device-actions">
                  <button 
                    onClick={() => handleRenameDevice(device.id, device.device_name)}
                    className="device-action-btn"
                  >
                    Rename
                  </button>
                  <button 
                    onClick={() => handleDeleteDevice(device.id)}
                    className="device-action-btn delete"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {offlineDevices.length > 0 && (
        <div className="devices-section">
          <h3 className="devices-section-title">Offline Devices</h3>
          <div className="devices-list">
            {offlineDevices.map(device => (
              <div key={device.id} className="device-card offline">
                <div className="device-header">
                  <span className="device-icon">{getDeviceIcon(device.device_type)}</span>
                  <div className="device-info">
                    <h4 className="device-name">{device.device_name}</h4>
                    <p className="device-details">
                      {device.browser} • {device.os}
                    </p>
                    <p className="device-last-seen">
                      Last seen: {new Date(device.last_seen).toLocaleString()}
                    </p>
                  </div>
                  <span className="device-status offline-badge">Offline</span>
                </div>
                <div className="device-actions">
                  <button 
                    onClick={() => handleRenameDevice(device.id, device.device_name)}
                    className="device-action-btn"
                  >
                    Rename
                  </button>
                  <button 
                    onClick={() => handleDeleteDevice(device.id)}
                    className="device-action-btn delete"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
