'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#ffffff' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #333', padding: '1rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>AI CRM Platform</h1>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={() => setActiveView('dashboard')} style={{ padding: '0.5rem 1rem', backgroundColor: activeView === 'dashboard' ? '#4f46e5' : 'transparent', color: 'white', borderRadius: '0.5rem', border: activeView === 'dashboard' ? 'none' : '1px solid #333', cursor: 'pointer', fontWeight: '500' }}>Dashboard</button>
            <button onClick={() => setActiveView('schemas')} style={{ padding: '0.5rem 1rem', backgroundColor: activeView === 'schemas' ? '#4f46e5' : 'transparent', color: 'white', borderRadius: '0.5rem', border: activeView === 'schemas' ? 'none' : '1px solid #333', cursor: 'pointer', fontWeight: '500' }}>Schemas</button>
            <button onClick={() => setActiveView('data')} style={{ padding: '0.5rem 1rem', backgroundColor: activeView === 'data' ? '#4f46e5' : 'transparent', color: 'white', borderRadius: '0.5rem', border: activeView === 'data' ? 'none' : '1px solid #333', cursor: 'pointer', fontWeight: '500' }}>Data</button>
            <button onClick={() => setActiveView('theme')} style={{ padding: '0.5rem 1rem', backgroundColor: activeView === 'theme' ? '#4f46e5' : 'transparent', color: 'white', borderRadius: '0.5rem', border: activeView === 'theme' ? 'none' : '1px solid #333', cursor: 'pointer', fontWeight: '500' }}>Theme</button>
            <div style={{ width: '1px', height: '1.5rem', backgroundColor: '#333', margin: '0 0.5rem' }}></div>
            <button style={{ padding: '0.5rem 1rem', color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem' }}>
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'schemas' && <SchemasView />}
        {activeView === 'data' && <DataView />}
        {activeView === 'theme' && <ThemeView />}
      </div>
    </div>
  );
}

function DashboardView() {
  return (
    <div>
      <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Records', value: '156', color: '#4f46e5' },
          { label: 'Active Schemas', value: '8', color: '#8b5cf6' },
          { label: 'AI Interactions', value: '1.2k', color: '#ec4899' },
          { label: 'Revenue', value: '$12,450', color: '#10b981' }
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #333' }}>
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{stat.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #333' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' }}>Recent Activity</h3>
        {[
          { action: 'Created new schema: Leads', time: '2 minutes ago' },
          { action: 'Added record: Acme Corp', time: '15 minutes ago' },
          { action: 'Updated theme settings', time: '1 hour ago' }
        ].map((activity, i) => (
          <div key={i} style={{ padding: '0.75rem', borderBottom: i < 2 ? '1px solid #222' : 'none' }}>
            <p style={{ fontSize: '0.875rem', color: '#ffffff' }}>{activity.action}</p>
            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{activity.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchemasView() {
  const [schemas] = useState([
    { id: '1', name: 'Products', icon: '📦', fields: 5 },
    { id: '2', name: 'Companies', icon: '🏢', fields: 8 },
    { id: '3', name: 'Contacts', icon: '👤', fields: 6 }
  ]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ffffff' }}>Schemas</h2>
        <button style={{ padding: '0.5rem 1rem', backgroundColor: '#4f46e5', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Create Schema</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {schemas.map(schema => (
          <div key={schema.id} style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #333' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>{schema.icon}</span>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#ffffff' }}>{schema.name}</h3>
                <p style={{ fontSize: '0.875rem', color: '#999' }}>{schema.fields} fields</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ flex: 1, padding: '0.5rem', backgroundColor: '#222', color: '#fff', borderRadius: '0.375rem', border: '1px solid #333', cursor: 'pointer', fontSize: '0.875rem' }}>Edit</button>
              <button style={{ flex: 1, padding: '0.5rem', backgroundColor: '#4f46e5', color: 'white', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>View Data</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataView() {
  const [records] = useState([
    { id: '1', name: 'Premium Widget', price: 99.99, status: 'Active' },
    { id: '2', name: 'Basic Widget', price: 49.99, status: 'Active' },
    { id: '3', name: 'Deluxe Widget', price: 149.99, status: 'Inactive' }
  ]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ffffff' }}>Data Management</h2>
        <button style={{ padding: '0.5rem 1rem', backgroundColor: '#4f46e5', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Add Record</button>
      </div>

      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '0.75rem', border: '1px solid #333', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#111' }}>
            <tr>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>Name</th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>Price</th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} style={{ borderTop: '1px solid #222' }}>
                <td style={{ padding: '1rem 1.5rem', color: '#ffffff' }}>{record.name}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#ffffff' }}>${record.price}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ padding: '0.25rem 0.75rem', backgroundColor: record.status === 'Active' ? '#065f46' : '#7f1d1d', color: record.status === 'Active' ? '#6ee7b7' : '#fca5a5', borderRadius: '9999px', fontSize: '0.75rem' }}>
                    {record.status}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                  <button style={{ color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>Edit</button>
                  <button style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThemeView() {
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');

  return (
    <div>
      <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' }}>Theme Editor</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #333' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' }}>Colors</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>Primary Color</label>
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: '100%', height: '3rem', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', backgroundColor: '#111' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>Border Radius</label>
            <select style={{ width: '100%', padding: '0.5rem', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: '#111', color: '#fff' }}>
              <option>Smooth (8px)</option>
              <option>Rounded (16px)</option>
              <option>Very Rounded (24px)</option>
            </select>
          </div>
        </div>

        <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #333' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' }}>Preview</h3>
          <div style={{ marginBottom: '1rem' }}>
            <button style={{ padding: '0.5rem 1rem', backgroundColor: primaryColor, color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}>Primary Button</button>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#111', borderRadius: '0.5rem', border: '1px solid #333' }}>
            <p style={{ fontSize: '0.875rem', color: '#999' }}>This is a preview of your theme.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
