'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePagination } from '@/hooks/usePagination';

interface Contact {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  title?: string;
  isVIP?: boolean;
}

export default function ContactsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch function with pagination using API route
  const fetchContacts = useCallback(async (lastDoc?: any) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '50'
    });
    
    if (lastDoc) {
      searchParams.set('lastDoc', lastDoc);
    }

    const response = await fetch(`/api/workspace/${orgId}/contacts?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }
    
    return response.json();
  }, [orgId]);

  const {
    data: contacts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Contact>({ fetchFn: fetchContacts });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Client-side filtering (search happens on loaded data)
  const filteredContacts = contacts.filter(c => 
    !searchQuery || 
    (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/contacts/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Contact</button>
      </div>

      <input type="text" placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg mb-6" />

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {filteredContacts.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <p className="text-gray-400 mb-4">No contacts found. {searchQuery ? 'Try a different search term.' : 'Click "+ Add Contact" to create your first contact.'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map(contact => (
              <div key={contact.id} onClick={() => router.push(`/workspace/${orgId}/contacts/${contact.id}`)} className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800/50 transition cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
                    {((contact.name !== '' && contact.name != null) ? contact.name : ((contact.firstName !== '' && contact.firstName != null) ? contact.firstName : 'U')).charAt(0).toUpperCase()}
                  </div>
                  {contact.isVIP && <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs font-medium">VIP</span>}
                </div>
                <h3 className="font-semibold text-lg mb-1">{(contact.name !== '' && contact.name != null) ? contact.name : `${contact.firstName} ${contact.lastName}`}</h3>
                {contact.title && <p className="text-sm text-gray-400 mb-2">{contact.title}</p>}
                {contact.company && <p className="text-sm text-gray-400 mb-3">{contact.company}</p>}
                <div className="space-y-1 text-sm">
                  {contact.email && <div className="text-gray-400">✉️ {contact.email}</div>}
                  {contact.phone && <div className="text-gray-400">📞 {contact.phone}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${contacts.length} contacts)` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
