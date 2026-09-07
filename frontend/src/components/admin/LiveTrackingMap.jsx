import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const adminBusIcon = L.divIcon({
  className: 'admin-bus-marker',
  html: `<div style="
    width: 30px;
    height: 30px;
    background: #eab308;
    border: 3px solid #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 12px rgba(234, 179, 8, 0.6);
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <circle cx="7" cy="20" r="2" />
      <circle cx="17" cy="20" r="2" />
    </svg>
  </div>`,
  iconSize: [30, 30]
});

export default function LiveTrackingMap({ liveTrips }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card" style={{ height: '480px', padding: '12px' }}>
        <MapContainer 
          center={[18.5204, 73.8567]} 
          zoom={12} 
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {liveTrips.map(trip => {
            if (!trip.current_lat) return null;
            return (
              <Marker key={trip.id} position={[trip.current_lat, trip.current_lng]} icon={adminBusIcon}>
                <Popup>
                  <div style={{ color: '#000', fontSize: '12px' }}>
                    <div style={{ fontWeight: '700' }}>Bus: {trip.bus_number} ({trip.route_name})</div>
                    <div>Driver: {trip.driver_name}</div>
                    <div>Speed: {Math.round(trip.speed)} km/h</div>
                    <div>ETA: {trip.eta_mins} mins</div>
                    <div>Checked-in Students: {trip.student_count}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Active Trips telemetry table */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Active Transit Fleet Details</h3>
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Bus Unit</th>
                <th>Route Name</th>
                <th>Driver Name</th>
                <th>Current Position</th>
                <th>Speed</th>
                <th>Route ETA</th>
                <th>Checked-In</th>
              </tr>
            </thead>
            <tbody>
              {liveTrips.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No active transit routes on road.</td>
                </tr>
              ) : (
                liveTrips.map(trip => (
                  <tr key={trip.id}>
                    <td style={{ fontWeight: '700' }}>{trip.bus_number}</td>
                    <td>{trip.route_name}</td>
                    <td>{trip.driver_name}</td>
                    <td>{trip.current_stop_name || 'En Route'} → {trip.next_stop_name || 'Terminal'}</td>
                    <td>{Math.round(trip.speed)} km/h</td>
                    <td style={{ color: 'var(--accent-amber)', fontWeight: '700' }}>{trip.eta_mins} mins</td>
                    <td>{trip.student_count} passengers</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
