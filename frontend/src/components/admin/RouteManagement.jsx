import React from 'react';
import { Plus, Upload, MapPin, Edit, Trash2, X } from 'lucide-react';

export default function RouteManagement({
  routes,
  routeModal,
  setRouteModal,
  handleSaveRoute,
  handleDeleteRoute,
  stopsRoute,
  setStopsRoute,
  stopsList,
  stopModal,
  setStopModal,
  handleSaveStop,
  handleDeleteStop,
  handleOpenManageStops,
  setIsBulkStopsModalOpen,
  setBulkStopsRouteId
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Active Transit Route Planners & Stops</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Create and edit transit routes, configure pickup stops, coordinates, and schedules.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => {
              setBulkStopsRouteId(routes[0]?.id ? String(routes[0].id) : '');
              setIsBulkStopsModalOpen(true);
            }}
            className="btn-secondary" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Upload size={16} /> Bulk Import Stops (CSV)
          </button>
          <button 
            onClick={() => setRouteModal({
              isOpen: true,
              mode: 'add',
              data: { id: null, name: '', startLocation: '', endLocation: '', distanceKm: 15, estimatedDurationMins: 45 }
            })}
            className="btn-primary" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Add New Route
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Route Title</th>
                <th>Hub Departure</th>
                <th>Campus Arrival</th>
                <th>Distance (km)</th>
                <th>Est Duration</th>
                <th>Pickups Stops</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: '700' }}>{r.name}</td>
                  <td>{r.start_location}</td>
                  <td>{r.end_location}</td>
                  <td>{r.distance_km} km</td>
                  <td>{r.estimated_duration_mins} mins</td>
                  <td>
                    <button 
                      onClick={() => handleOpenManageStops(r)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MapPin size={12} color="var(--accent-cyan)" /> {r.stops_count || 0} Stops (Manage)
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => setRouteModal({
                          isOpen: true,
                          mode: 'edit',
                          data: {
                            id: r.id,
                            name: r.name,
                            startLocation: r.start_location,
                            endLocation: r.end_location,
                            distanceKm: r.distance_km,
                            estimatedDurationMins: r.estimated_duration_mins
                          }
                        })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                        title="Edit Route"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRoute(r.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                        title="Delete Route"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Route Modal */}
      {routeModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="glass-card" style={{ width: 'min(95vw, 480px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {routeModal.mode === 'add' ? 'Create Transit Route' : 'Edit Route Details'}
              </h3>
              <button onClick={() => setRouteModal({ ...routeModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Route Name / Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. North Hub - Campus Express"
                  value={routeModal.data.name} 
                  onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, name: e.target.value } })} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hub Departure (Start)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. North Terminal"
                    value={routeModal.data.startLocation} 
                    onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, startLocation: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Campus Arrival (End)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Main Engineering Campus"
                    value={routeModal.data.endLocation} 
                    onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, endLocation: e.target.value } })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Total Distance (km)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="input-field" 
                    placeholder="15.5"
                    value={routeModal.data.distanceKm} 
                    onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, distanceKm: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Estimated Duration (mins)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="45"
                    value={routeModal.data.estimatedDurationMins} 
                    onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, estimatedDurationMins: e.target.value } })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn-primary">
                  {routeModal.mode === 'add' ? 'Create Route' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setRouteModal({ ...routeModal, isOpen: false })} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Stops Drawer / Modal */}
      {stopsRoute && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="glass-card" style={{ width: 'min(95vw, 640px)', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Manage Stops: {stopsRoute.name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Configure pickup stop sequence, scheduled times, and GPS coordinates.</span>
              </div>
              <button onClick={() => setStopsRoute(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                onClick={() => {
                  setBulkStopsRouteId(String(stopsRoute.id));
                  setIsBulkStopsModalOpen(true);
                }}
                className="btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={14} /> Bulk CSV Import
              </button>
              <button 
                onClick={() => setStopModal({
                  isOpen: true,
                  mode: 'add',
                  data: { id: null, name: '', latitude: 18.5204, longitude: 73.8567, sequenceOrder: stopsList.length + 1, scheduledTime: '07:30 AM' }
                })}
                className="btn-primary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Add Pickup Stop
              </button>
            </div>

            <div className="table-responsive">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Seq #</th>
                    <th>Stop Name</th>
                    <th>Scheduled Pickup</th>
                    <th>Coordinates (Lat, Lng)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stopsList.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No pickup stops created yet.</td>
                    </tr>
                  ) : (
                    stopsList.map(stop => (
                      <tr key={stop.id}>
                        <td style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>#{stop.sequence_order}</td>
                        <td style={{ fontWeight: '600' }}>{stop.name}</td>
                        <td>{stop.scheduled_time}</td>
                        <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{stop.latitude}, {stop.longitude}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button 
                              onClick={() => setStopModal({
                                isOpen: true,
                                mode: 'edit',
                                data: {
                                  id: stop.id,
                                  name: stop.name,
                                  latitude: stop.latitude,
                                  longitude: stop.longitude,
                                  sequenceOrder: stop.sequence_order,
                                  scheduledTime: stop.scheduled_time
                                }
                              })}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                              title="Edit Stop"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteStop(stop.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                              title="Delete Stop"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button onClick={() => setStopsRoute(null)} className="btn-secondary" style={{ width: 'auto' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Stop Modal */}
      {stopModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="glass-card" style={{ width: 'min(95vw, 420px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                {stopModal.mode === 'add' ? 'Add Pickup Stop' : 'Edit Pickup Stop'}
              </h3>
              <button onClick={() => setStopModal({ ...stopModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStop} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Stop Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Navale Bridge / Malleswaram"
                  value={stopModal.data.name} 
                  onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, name: e.target.value } })} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Sequence Order</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="1"
                    value={stopModal.data.sequenceOrder} 
                    onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, sequenceOrder: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Scheduled Pickup Time</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="07:30 AM"
                    value={stopModal.data.scheduledTime} 
                    onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, scheduledTime: e.target.value } })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Latitude</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    className="input-field" 
                    value={stopModal.data.latitude} 
                    onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, latitude: e.target.value } })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Longitude</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    className="input-field" 
                    value={stopModal.data.longitude} 
                    onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, longitude: e.target.value } })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn-primary">Save Stop</button>
                <button type="button" onClick={() => setStopModal({ ...stopModal, isOpen: false })} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
