'use client';

import Link from 'next/link';

export default function DashboardPage() {
  const stats = [
    { label: 'Total Records', value: '156', change: '+12%', color: 'indigo' },
    { label: 'Active Schemas', value: '8', change: '+2', color: 'purple' },
    { label: 'AI Interactions', value: '1.2k', change: '+24%', color: 'pink' },
    { label: 'Revenue', value: '$12,450', change: '+18%', color: 'green' },
  ];

  const recentActivity = [
    { action: 'Created new schema', detail: 'Leads', time: '2 minutes ago', icon: '📋' },
    { action: 'Added record', detail: 'Company: Acme Corp', time: '15 minutes ago', icon: '✅' },
    { action: 'Updated theme', detail: 'Changed primary color', time: '1 hour ago', icon: '🎨' },
    { action: 'AI Agent trained', detail: 'Sales Agent v2', time: '3 hours ago', icon: '🤖' },
  ];

  const quickActions = [
    { label: 'Create Schema', href: '/workspace/demo/schemas', icon: '📋', color: 'indigo' },
    { label: 'Add Data', href: '/workspace/demo/entities/products', icon: '➕', color: 'purple' },
    { label: 'Edit Theme', href: '/workspace/demo/settings/theme', icon: '🎨', color: 'pink' },
    { label: 'View Analytics', href: '#', icon: '📊', color: 'green' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-indigo-600 hover:text-indigo-800 text-sm mb-1 block">
                ← Back to Home
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <span className="text-green-500 text-sm font-medium">{stat.change}</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Chart Placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Activity Overview</h2>
              <div className="h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl mb-2">📈</p>
                  <p className="text-gray-600">Chart visualization coming soon</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <span className="text-2xl">{activity.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.detail}</p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">System Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">AI Services</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Operational
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

