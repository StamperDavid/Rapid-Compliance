'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ImportService } from '@/lib/import/import-service';
import type { ImportSession, ColumnMapping } from '@/types/import';

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'import'>('upload');
  const [importSession, setImportSession] = useState<Partial<ImportSession> | null>(null);
  const [targetEntity, setTargetEntity] = useState('products');
  const [createNew, setCreateNew] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entities = ['leads', 'companies', 'contacts', 'deals', 'products', 'services', 'quotes', 'invoices', 'orders'];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Parse CSV
      const { headers, rows } = await ImportService.parseCSV(file);

      // Auto-detect schema
      const entityName = createNew ? newEntityName : targetEntity;
      const detectedSchema = ImportService.detectSchema(headers, rows, entityName);

      // Generate column mappings
      const mappings = ImportService.generateMappings(headers, rows);

      setImportSession({
        id: Date.now().toString(),
        fileName: file.name,
        fileSize: file.size,
        targetEntity: entityName,
        createNewEntity: createNew,
        newEntityName: createNew ? newEntityName : undefined,
        headers,
        rows,
        totalRows: rows.length,
        columnMappings: mappings,
        autoDetectedSchema: detectedSchema,
        status: 'uploaded',
        skipFirstRow: false,
        updateExisting: false,
        importedCount: 0,
        failedCount: 0,
        errors: [],
        progress: 0,
      });

      setStep('map');
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMapping = (index: number, field: keyof ColumnMapping, value: any) => {
    if (!importSession) return;
    
    const newMappings = [...(importSession.columnMappings || [])];
    newMappings[index] = { ...newMappings[index], [field]: value };
    
    setImportSession({ ...importSession, columnMappings: newMappings });
  };

  const handlePreview = () => {
    if (!importSession) return;
    
    // Validate data
    const validation = ImportService.validateData(
      importSession.rows || [],
      importSession.columnMappings || []
    );
    
    setImportSession({
      ...importSession,
      errors: validation.errors,
      status: 'validated',
    });
    
    setStep('preview');
  };

  const handleImport = async () => {
    if (!importSession) return;
    
    setIsProcessing(true);
    setStep('import');

    try {
      // Simulate import with progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setImportSession(prev => prev ? { ...prev, progress: i } : prev);
      }

      // In production, this would actually import to the database
      setImportSession(prev => prev ? {
        ...prev,
        status: 'completed',
        importedCount: importSession.rows?.length || 0,
        progress: 100,
      } : prev);

    } catch (err: any) {
      setError(err.message || 'Import failed');
      setImportSession(prev => prev ? { ...prev, status: 'failed' } : prev);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/crm" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                ← Back to CRM
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
                <p className="text-sm text-gray-500 mt-1">Upload CSV/Excel and auto-map to your CRM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {['Upload', 'Map Columns', 'Preview', 'Import'].map((label, index) => {
              const stepNames = ['upload', 'map', 'preview', 'import'];
              const currentIndex = stepNames.indexOf(step);
              const isActive = index === currentIndex;
              const isCompleted = index < currentIndex;

              return (
                <div key={label} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isActive ? 'bg-indigo-600 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span className={`ml-3 text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </div>
                  {index < 3 && (
                    <div className={`flex-1 h-1 mx-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Your Data</h2>

              {/* Target Entity Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Import Into
                </label>
                <div className="flex items-center gap-4 mb-3">
                  <select
                    value={targetEntity}
                    onChange={(e) => setTargetEntity(e.target.value)}
                    disabled={createNew}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                  >
                    {entities.map(entity => (
                      <option key={entity} value={entity}>{entity.charAt(0).toUpperCase() + entity.slice(1)}</option>
                    ))}
                  </select>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={createNew}
                      onChange={(e) => setCreateNew(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Create New</span>
                  </label>
                </div>

                {createNew && (
                  <input
                    type="text"
                    value={newEntityName}
                    onChange={(e) => setNewEntityName(e.target.value)}
                    placeholder="New entity name (e.g., Suppliers)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                )}
              </div>

              {/* File Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
              >
                <div className="text-6xl mb-4">📄</div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-gray-500">
                  CSV or Excel files (Max 10MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {isProcessing && (
                <div className="mt-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="text-sm text-gray-600 mt-2">Processing file...</p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 'map' && importSession && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Map Columns</h2>
              <p className="text-sm text-gray-600">
                Match your CSV columns to CRM fields. Auto-detected types are shown below.
              </p>
            </div>

            {/* Schema Detection Info */}
            {importSession.autoDetectedSchema && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">✨ Auto-Detected Schema</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Confidence: {Math.round(importSession.autoDetectedSchema.confidence)}%
                </p>
                {importSession.autoDetectedSchema.suggestions.length > 0 && (
                  <ul className="text-sm text-blue-700 list-disc list-inside">
                    {importSession.autoDetectedSchema.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Column Mappings Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">CSV Column</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Sample Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">CRM Field</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Field Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {importSession.columnMappings?.map((mapping, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{mapping.csvColumn}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="truncate max-w-xs" title={mapping.sampleValues.join(', ')}>
                          {mapping.sampleValues[0] || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={mapping.targetField}
                          onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mapping.fieldType}
                          onChange={(e) => updateMapping(index, 'fieldType', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="currency">Currency</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="url">URL</option>
                          <option value="date">Date</option>
                          <option value="boolean">Boolean</option>
                          <option value="select">Select</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={mapping.isRequired}
                          onChange={(e) => updateMapping(index, 'isRequired', e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                onClick={handlePreview}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                Continue to Preview
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 'preview' && importSession && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Preview & Validate</h2>

            {/* Validation Summary */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Total Rows</p>
                <p className="text-2xl font-bold text-green-900">{importSession.totalRows}</p>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-600 font-medium">Warnings</p>
                <p className="text-2xl font-bold text-amber-900">
                  {importSession.errors?.filter(e => e.severity === 'warning').length || 0}
                </p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Errors</p>
                <p className="text-2xl font-bold text-red-900">
                  {importSession.errors?.filter(e => e.severity === 'error').length || 0}
                </p>
              </div>
            </div>

            {/* Errors List */}
            {importSession.errors && importSession.errors.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg max-h-60 overflow-y-auto">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">Validation Issues</h3>
                <ul className="space-y-1">
                  {importSession.errors.slice(0, 20).map((error, i) => (
                    <li key={i} className="text-sm text-amber-800">
                      Row {error.row}, Column "{error.column}": {error.message}
                      {error.value && <span className="font-mono ml-1">({error.value})</span>}
                    </li>
                  ))}
                  {importSession.errors.length > 20 && (
                    <li className="text-sm text-amber-700 italic">
                      ... and {importSession.errors.length - 20} more issues
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Data Preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Preview (First 5 rows)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {importSession.columnMappings?.map((mapping, i) => (
                        <th key={i} className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                          {mapping.targetField}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {importSession.rows?.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {importSession.columnMappings?.map((mapping, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 text-gray-900">
                            {ImportService.transformValue(row[mapping.csvColumnIndex], mapping) || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('map')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Back to Mapping
              </button>
              <button
                onClick={handleImport}
                disabled={importSession.errors?.some(e => e.severity === 'error')}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Import ({importSession.totalRows} records)
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: IMPORT */}
        {step === 'import' && importSession && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              {importSession.status === 'importing' || isProcessing ? (
                <>
                  <div className="text-6xl mb-4">⏳</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Importing Data...</h2>
                  <p className="text-gray-600 mb-6">Please wait while we import your records</p>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div
                      className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${importSession.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">{importSession.progress}% Complete</p>
                </>
              ) : importSession.status === 'completed' ? (
                <>
                  <div className="text-6xl mb-4">✅</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
                  <p className="text-gray-600 mb-6">
                    Successfully imported {importSession.importedCount} records
                  </p>
                  <Link
                    href="/crm"
                    className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                  >
                    Go to CRM
                  </Link>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">❌</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Failed</h2>
                  <p className="text-gray-600 mb-6">{error}</p>
                  <button
                    onClick={() => setStep('upload')}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                  >
                    Start Over
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

