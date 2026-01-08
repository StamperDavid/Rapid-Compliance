'use client';

import React, { useState } from 'react';
import type { ReportFilter, ReportMetric, ReportVisualization, CustomReport } from '@/types/analytics';

interface ReportBuilderProps {
  report?: CustomReport;
  onSave: (report: Partial<CustomReport>) => void;
  onCancel: () => void;
}

export default function ReportBuilder({ report, onSave, onCancel }: ReportBuilderProps) {
  const [name, setName] = useState(report?.name ?? '');
  const [description, setDescription] = useState(report?.description ?? '');
  const [dataSource, setDataSource] = useState(report?.dataSource ?? '');
  const [filters, setFilters] = useState<ReportFilter[]>(report?.filters ?? []);
  const [metrics, setMetrics] = useState<ReportMetric[]>(report?.metrics ?? []);
  const [visualization, setVisualization] = useState<ReportVisualization>(report?.visualization ?? {
    type: 'table',
  });

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#ffffff'
    : '#ffffff';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || '#333333'
    : '#333333';

  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const updateFilter = (index: number, filter: Partial<ReportFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...filter };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const addMetric = () => {
    setMetrics([...metrics, { field: '', aggregation: 'count', label: '' }]);
  };

  const updateMetric = (index: number, metric: Partial<ReportMetric>) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], ...metric };
    setMetrics(newMetrics);
  };

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      dataSource,
      filters,
      metrics,
      visualization,
    });
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
      color: textColor
    }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
        {report ? 'Edit Report' : 'Create New Report'}
      </h3>

      {/* Basic Info */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
          Report Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.625rem',
            backgroundColor: 'var(--color-bg-main)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.375rem',
            color: textColor,
            fontSize: '0.875rem'
          }}
          placeholder="e.g., Monthly Sales Report"
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{
            width: '100%',
            padding: '0.625rem',
            backgroundColor: 'var(--color-bg-main)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.375rem',
            color: textColor,
            fontSize: '0.875rem',
            minHeight: '80px'
          }}
          placeholder="Optional description"
        />
      </div>

      {/* Data Source */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
          Data Source
        </label>
        <select
          value={dataSource}
          onChange={(e) => setDataSource(e.target.value)}
          style={{
            width: '100%',
            padding: '0.625rem',
            backgroundColor: 'var(--color-bg-main)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.375rem',
            color: textColor,
            fontSize: '0.875rem'
          }}
        >
          <option value="">Select entity...</option>
          <option value="deals">Deals</option>
          <option value="contacts">Contacts</option>
          <option value="companies">Companies</option>
          <option value="leads">Leads</option>
        </select>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Filters</label>
          <button
            onClick={addFilter}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            + Add Filter
          </button>
        </div>
        {filters.map((filter, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Field"
              value={filter.field}
              onChange={(e) => updateFilter(index, { field: e.target.value })}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            />
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(index, { operator: e.target.value as any })}
              style={{
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="contains">Contains</option>
              <option value="greater_than">Greater Than</option>
              <option value="less_than">Less Than</option>
            </select>
            <input
              type="text"
              placeholder="Value"
              value={filter.value as string}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            />
            <button
              onClick={() => removeFilter(index)}
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Metrics</label>
          <button
            onClick={addMetric}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            + Add Metric
          </button>
        </div>
        {metrics.map((metric, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Field"
              value={metric.field}
              onChange={(e) => updateMetric(index, { field: e.target.value })}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            />
            <select
              value={metric.aggregation}
              onChange={(e) => updateMetric(index, { aggregation: e.target.value as any })}
              style={{
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            >
              <option value="count">Count</option>
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
            <input
              type="text"
              placeholder="Label"
              value={metric.label}
              onChange={(e) => updateMetric(index, { label: e.target.value })}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            />
            <button
              onClick={() => removeMetric(index)}
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.375rem',
                color: textColor,
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Visualization */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
          Visualization Type
        </label>
        <select
          value={visualization.type}
          onChange={(e) => setVisualization({ ...visualization, type: e.target.value as any })}
          style={{
            width: '100%',
            padding: '0.625rem',
            backgroundColor: 'var(--color-bg-main)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.375rem',
            color: textColor,
            fontSize: '0.875rem'
          }}
        >
          <option value="table">Table</option>
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
          <option value="pie">Pie Chart</option>
          <option value="area">Area Chart</option>
        </select>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: 'transparent',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: textColor,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: primaryColor,
            border: 'none',
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {report ? 'Update Report' : 'Create Report'}
        </button>
      </div>
    </div>
  );
}

























