'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  gradient: {
    type: 'linear' | 'radial' | 'conic';
    angle: number;
    stops: { color: string; position: number }[];
  };
  borderRadius: {
    card: string;
    button: string;
    input: string;
  };
  logo: {
    url: string;
    darkUrl: string;
  };
  companyName: string;
}

export default function ThemeEditorPage() {
  const [theme, setTheme] = useState<ThemeConfig>({
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#ec4899'
    },
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#6366f1', position: 0 },
        { color: '#8b5cf6', position: 50 },
        { color: '#ec4899', position: 100 }
      ]
    },
    borderRadius: {
      card: '16px',
      button: '8px',
      input: '6px'
    },
    logo: {
      url: '',
      darkUrl: ''
    },
    companyName: 'My Company'
  });

  const [activeTab, setActiveTab] = useState<'colors' | 'gradient' | 'curves' | 'branding'>('colors');

  const updateColor = (key: 'primary' | 'secondary' | 'accent', value: string) => {
    setTheme({
      ...theme,
      colors: { ...theme.colors, [key]: value }
    });
  };

  const updateGradientStop = (index: number, key: 'color' | 'position', value: any) => {
    const newStops = [...theme.gradient.stops];
    newStops[index] = { ...newStops[index], [key]: value };
    setTheme({
      ...theme,
      gradient: { ...theme.gradient, stops: newStops }
    });
  };

  const addGradientStop = () => {
    setTheme({
      ...theme,
      gradient: {
        ...theme.gradient,
        stops: [...theme.gradient.stops, { color: '#ffffff', position: 50 }]
      }
    });
  };

  const getGradientCSS = () => {
    const stops = theme.gradient.stops
      .sort((a, b) => a.position - b.position)
      .map(s => `${s.color} ${s.position}%`)
      .join(', ');
    
    switch (theme.gradient.type) {
      case 'linear':
        return `linear-gradient(${theme.gradient.angle}deg, ${stops})`;
      case 'radial':
        return `radial-gradient(circle, ${stops})`;
      case 'conic':
        return `conic-gradient(from ${theme.gradient.angle}deg, ${stops})`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-indigo-600 hover:text-indigo-800">
                ← Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Theme Editor</h1>
            </div>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Save Theme
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                {(['colors', 'gradient', 'curves', 'branding'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-3 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-6">
                {/* Colors Tab */}
                {activeTab === 'colors' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={theme.colors.primary}
                          onChange={(e) => updateColor('primary', e.target.value)}
                          className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.colors.primary}
                          onChange={(e) => updateColor('primary', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Secondary Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={theme.colors.secondary}
                          onChange={(e) => updateColor('secondary', e.target.value)}
                          className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.colors.secondary}
                          onChange={(e) => updateColor('secondary', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accent Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={theme.colors.accent}
                          onChange={(e) => updateColor('accent', e.target.value)}
                          className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.colors.accent}
                          onChange={(e) => updateColor('accent', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Gradient Tab */}
                {activeTab === 'gradient' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gradient Type
                      </label>
                      <select
                        value={theme.gradient.type}
                        onChange={(e) => setTheme({ ...theme, gradient: { ...theme.gradient, type: e.target.value as any } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="linear">Linear</option>
                        <option value="radial">Radial</option>
                        <option value="conic">Conic</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Angle: {theme.gradient.angle}°
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={theme.gradient.angle}
                        onChange={(e) => setTheme({ ...theme, gradient: { ...theme.gradient, angle: parseInt(e.target.value) } })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Gradient Stops
                        </label>
                        <button
                          onClick={addGradientStop}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          + Add Stop
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {theme.gradient.stops.map((stop, index) => (
                          <div key={index} className="flex gap-3 items-center">
                            <input
                              type="color"
                              value={stop.color}
                              onChange={(e) => updateGradientStop(index, 'color', e.target.value)}
                              className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                            />
                            <input
                              type="number"
                              value={stop.position}
                              onChange={(e) => updateGradientStop(index, 'position', parseInt(e.target.value))}
                              min="0"
                              max="100"
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Curves Tab */}
                {activeTab === 'curves' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Corners
                      </label>
                      <select
                        value={theme.borderRadius.card}
                        onChange={(e) => setTheme({ ...theme, borderRadius: { ...theme.borderRadius, card: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="4px">Sharp (4px)</option>
                        <option value="8px">Subtle (8px)</option>
                        <option value="12px">Smooth (12px)</option>
                        <option value="16px">Rounded (16px)</option>
                        <option value="24px">Very Rounded (24px)</option>
                        <option value="32px">Ultra Rounded (32px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Button Corners
                      </label>
                      <select
                        value={theme.borderRadius.button}
                        onChange={(e) => setTheme({ ...theme, borderRadius: { ...theme.borderRadius, button: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="4px">Sharp (4px)</option>
                        <option value="6px">Subtle (6px)</option>
                        <option value="8px">Smooth (8px)</option>
                        <option value="12px">Rounded (12px)</option>
                        <option value="9999px">Pill (Fully Rounded)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Input Corners
                      </label>
                      <select
                        value={theme.borderRadius.input}
                        onChange={(e) => setTheme({ ...theme, borderRadius: { ...theme.borderRadius, input: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="4px">Sharp (4px)</option>
                        <option value="6px">Subtle (6px)</option>
                        <option value="8px">Smooth (8px)</option>
                        <option value="12px">Rounded (12px)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Branding Tab */}
                {activeTab === 'branding' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={theme.companyName}
                        onChange={(e) => setTheme({ ...theme, companyName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Your Company Name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo URL (Light Mode)
                      </label>
                      <input
                        type="url"
                        value={theme.logo.url}
                        onChange={(e) => setTheme({ ...theme, logo: { ...theme.logo, url: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="https://yoursite.com/logo.svg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo URL (Dark Mode)
                      </label>
                      <input
                        type="url"
                        value={theme.logo.darkUrl}
                        onChange={(e) => setTheme({ ...theme, logo: { ...theme.logo, darkUrl: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="https://yoursite.com/logo-dark.svg"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Live Preview</h3>
              
              {/* Gradient Preview */}
              <div
                className="h-48 rounded-2xl mb-6 flex items-center justify-center text-white font-bold text-2xl"
                style={{ background: getGradientCSS() }}
              >
                {theme.companyName || 'Your Brand'}
              </div>

              {/* Component Previews */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Buttons</p>
                  <div className="flex gap-2">
                    <button
                      style={{
                        backgroundColor: theme.colors.primary,
                        borderRadius: theme.borderRadius.button
                      }}
                      className="px-4 py-2 text-white font-medium"
                    >
                      Primary
                    </button>
                    <button
                      style={{
                        backgroundColor: theme.colors.secondary,
                        borderRadius: theme.borderRadius.button
                      }}
                      className="px-4 py-2 text-white font-medium"
                    >
                      Secondary
                    </button>
                    <button
                      style={{
                        backgroundColor: theme.colors.accent,
                        borderRadius: theme.borderRadius.button
                      }}
                      className="px-4 py-2 text-white font-medium"
                    >
                      Accent
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Card</p>
                  <div
                    className="bg-white border border-gray-200 p-4"
                    style={{ borderRadius: theme.borderRadius.card }}
                  >
                    <h4 className="font-bold text-gray-900 mb-2">Card Title</h4>
                    <p className="text-sm text-gray-600">This is how cards will look with your theme.</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Input Fields</p>
                  <input
                    type="text"
                    placeholder="Your input..."
                    className="w-full px-3 py-2 border border-gray-300"
                    style={{ borderRadius: theme.borderRadius.input }}
                  />
                </div>
              </div>
            </div>

            {/* CSS Output */}
            <div className="bg-gray-900 rounded-xl p-6 text-white">
              <h3 className="text-lg font-bold mb-4">Generated CSS</h3>
              <pre className="text-xs overflow-x-auto">
                {`:root {
  --color-primary: ${theme.colors.primary};
  --color-secondary: ${theme.colors.secondary};
  --color-accent: ${theme.colors.accent};
  
  --gradient: ${getGradientCSS()};
  
  --radius-card: ${theme.borderRadius.card};
  --radius-button: ${theme.borderRadius.button};
  --radius-input: ${theme.borderRadius.input};
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

