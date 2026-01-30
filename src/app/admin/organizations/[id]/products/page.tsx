'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Package, Search, Loader2, ChevronDown } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';
import type { Product } from '@/lib/ecommerce/product-service';

/**
 * Admin Support View: Products
 * View products for any tenant organization.
 */
export default function AdminOrgProductsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canManageOrg = hasPermission('canEditOrganizations');
  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  useEffect(() => {
    async function loadOrganization() {
      try {
        setOrgLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/products/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const fetchProducts = useCallback(async (lastDoc?: unknown) => {
    const { getProducts } = await import('@/lib/ecommerce/product-service');
    return getProducts(orgId, 'default', undefined, { pageSize: 50, lastDoc: lastDoc as undefined });
  }, [orgId]);

  const { data: products, loading, hasMore, loadMore, refresh } = usePagination<Product>({ fetchFn: fetchProducts });

  useEffect(() => { void refresh(); }, [refresh]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const filteredProducts = products.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        <Link href={`/admin/organizations/${orgId}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Organization
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ backgroundColor: '#1a1a2e', border: `1px solid ${primaryColor}40`, borderRadius: '0.75rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: `${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Admin Support View</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Products for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}</div>
          </div>
          {canManageOrg && <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#f59e0b' }}>
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Products</h1>
              <p className="text-gray-400">{products.length} products in catalog</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-gray-500 focus:outline-none" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }} />
          </div>
        </motion.div>

        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : products.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f59e0b10', border: '1px solid #ffffff10' }}>
              <Package className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No products found</div>
            <div className="text-gray-400">This organization has no products.</div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div key={product.id} onClick={() => router.push(`/workspace/${orgId}/products/${product.id}`)} className="p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02]" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${product.inStock ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                <div className="font-semibold text-white mb-1">{product.name}</div>
                {product.category && <div className="text-sm text-gray-500 mb-2">{product.category}</div>}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400 font-semibold">{product.price ? formatCurrency(product.price) : '-'}</span>
                  {product.stockQuantity !== undefined && <span className="text-gray-500">{product.stockQuantity} in stock</span>}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {hasMore && <div className="mt-6 text-center"><button onClick={() => void loadMore()} disabled={loading} className="px-6 py-2.5 rounded-xl flex items-center gap-2 mx-auto disabled:opacity-50" style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff20', color: '#fff' }}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}{loading ? 'Loading...' : 'Load More'}</button></div>}
      </div>
    </div>
  );
}
