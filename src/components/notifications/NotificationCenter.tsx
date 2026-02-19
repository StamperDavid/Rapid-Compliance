/**
 * Notification Center Component
 * 
 * Displays in-app notifications with filtering and mark-as-read functionality.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Notification, NotificationCategory } from '@/lib/notifications/types';
import { logger } from '@/lib/logger/logger';

interface NotificationCenterProps {
  userId: string;
  className?: string;
}

export function NotificationCenter({ userId, className = '' }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [_categoryFilter, _setCategoryFilter] = useState<NotificationCategory | 'all'>('all');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        unreadOnly: filter === 'unread' ? 'true' : 'false',
        limit: '50',
      });

      if (_categoryFilter !== 'all') {
        params.append('categories', _categoryFilter);
      }

      const response = await fetch(`/api/notifications/list?${params}`, {
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await response.json() as { success: boolean; notifications: Notification[] };

      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      logger.error('Failed to load notifications', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [userId, filter, _categoryFilter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(notificationIds: string[]) {
    try {
      const response = await fetch('/api/notifications/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ notificationIds }),
      });

      if (response.ok) {
        // Refresh notifications
        void loadNotifications();
      }
    } catch (error) {
      logger.error('Failed to mark as read', error instanceof Error ? error : new Error(String(error)));
    }
  }

  function handleMarkAsRead(id: string) {
    void markAsRead([id]);
  }

  function handleMarkAllAsRead() {
    const unreadIds = notifications
      .filter((n) => !n.metadata.read)
      .map((n) => n.id)
      .filter((id): id is string => id !== undefined);

    if (unreadIds.length > 0) {
      void markAsRead(unreadIds);
    }
  }

  const unreadCount = notifications.filter((n) => !n.metadata.read).length;

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const isUnread = !notification.metadata.read;
  const content = notification.content.inApp;

  if (!content) {return null;}

  const priorityColors = {
    critical: 'bg-red-50 border-red-200',
    high: 'bg-orange-50 border-orange-200',
    medium: 'bg-blue-50 border-blue-200',
    low: 'bg-gray-50 border-gray-200',
  };

  const priorityDots = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-gray-500',
  };

  return (
    <div
      className={`p-4 hover:bg-gray-50 cursor-pointer border-l-4 ${
        priorityColors[notification.priority]
      } ${isUnread ? 'bg-blue-50/30' : ''}`}
      onClick={() => {
        if (isUnread && notification.id) {
          onMarkAsRead(notification.id);
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Priority Indicator */}
        <div className={`w-2 h-2 rounded-full mt-2 ${priorityDots[notification.priority]}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className={`text-sm font-medium text-gray-900 ${isUnread ? 'font-semibold' : ''}`}>
                {content.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{content.body}</p>
            </div>

            {/* Timestamp */}
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTimestamp(notification.metadata.createdAt)}
            </span>
          </div>

          {/* Category Badge */}
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {formatCategory(notification.category)}
            </span>
          </div>

          {/* Action URL */}
          {content.actionUrl && (
            <a
              href={content.actionUrl}
              className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              View Details →
            </a>
          )}
        </div>

        {/* Unread Indicator */}
        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
        )}
      </div>
    </div>
  );
}

interface FirestoreTimestamp {
  toDate: () => Date;
}

function formatTimestamp(timestamp: FirestoreTimestamp | string | Date | number | undefined): string {
  if (!timestamp) {return '';}

  const date = typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp
    ? timestamp.toDate()
    : new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {return 'Just now';}
  if (minutes < 60) {return `${minutes}m ago`;}
  if (hours < 24) {return `${hours}h ago`;}
  if (days < 7) {return `${days}d ago`;}

  return date.toLocaleDateString();
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
