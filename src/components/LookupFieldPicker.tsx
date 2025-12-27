'use client';

import { useState, useEffect, useCallback } from 'react';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

interface LookupFieldPickerProps {
  organizationId: string;
  workspaceId: string;
  targetEntity: string; // Which entity to look up (e.g., 'contacts', 'deals')
  value: string | null; // Currently selected record ID
  onChange: (recordId: string | null, record: any | null) => void;
  label: string;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function LookupFieldPicker({
  organizationId,
  workspaceId,
  targetEntity,
  value,
  onChange,
  label,
  placeholder = 'Search and select...',
  style,
  disabled = false,
}: LookupFieldPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Load initial selected record
  useEffect(() => {
    if (value && !selectedRecord) {
      loadSelectedRecord(value);
    }
  }, [value]);

  // Load records when search changes
  useEffect(() => {
    if (isOpen) {
      loadRecords();
    }
  }, [searchTerm, isOpen, targetEntity]);

  const loadSelectedRecord = async (recordId: string) => {
    try {
      const path = `organizations/${organizationId}/workspaces/${workspaceId}/entities/${targetEntity}/records`;
      const record = await FirestoreService.get(path, recordId);
      if (record) {
        setSelectedRecord(record);
      }
    } catch (error) {
      logger.error('Failed to load selected record', error, { recordId, targetEntity });
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const path = `organizations/${organizationId}/workspaces/${workspaceId}/entities/${targetEntity}/records`;
      
      // Get all records (in production, this should use pagination with a reasonable limit)
      const allRecords = await FirestoreService.getAll(path, []);
      
      // Filter by search term
      let filtered = allRecords;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = allRecords.filter((record: any) => {
          // Search across common name fields
          const name = record.name || record.firstName + ' ' + record.lastName || record.title || record.companyName || record.id;
          return name.toLowerCase().includes(searchLower);
        });
      }
      
      // Limit to 50 results
      setRecords(filtered.slice(0, 50));
    } catch (error) {
      logger.error('Failed to load lookup records', error, { targetEntity });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (record: any) => {
    setSelectedRecord(record);
    onChange(record.id, record);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    setSelectedRecord(null);
    onChange(null, null);
  };

  const getDisplayName = (record: any) => {
    if (!record) return '';
    return record.name || 
           (record.firstName && record.lastName ? `${record.firstName} ${record.lastName}` : '') ||
           record.title ||
           record.companyName ||
           record.email ||
           record.id;
  };

  const baseInputStyle = style || {
    width: '100%',
    padding: '0.625rem',
    backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-border-main)',
    borderRadius: '0.375rem',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Display selected value or search input */}
      {selectedRecord && !isOpen ? (
        <div style={{ ...baseInputStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{getDisplayName(selectedRecord)}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setIsOpen(true)}
              disabled={disabled}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              Change
            </button>
            <button
              onClick={handleClear}
              disabled={disabled}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={baseInputStyle}
        />
      )}

      {/* Dropdown list */}
      {isOpen && !disabled && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          />
          
          {/* Dropdown */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '0.25rem',
              backgroundColor: 'var(--color-bg-paper)',
              border: '1px solid var(--color-border-main)',
              borderRadius: '0.375rem',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            {loading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                Loading...
              </div>
            ) : records.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                {searchTerm ? 'No records found' : `No ${targetEntity} available`}
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  onClick={() => handleSelect(record)}
                  style={{
                    padding: '0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border-main)',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {getDisplayName(record)}
                  </div>
                  {record.email && (
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.125rem' }}>
                      {record.email}
                    </div>
                  )}
                  {record.company && (
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.125rem' }}>
                      {record.company}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}



