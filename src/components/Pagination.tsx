/**
 * Pagination Component
 * Reusable pagination with page size selector
 */

import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSize = true,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show subset with ellipsis
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1 && !showPageSize) {
    return null; // Don't show pagination if only one page
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 1.5rem',
      backgroundColor: '#0a0a0a',
      borderTop: '1px solid #1a1a1a',
      borderRadius: '0 0 0.75rem 0.75rem',
    }}>
      {/* Results info */}
      <div style={{ color: '#666', fontSize: '0.875rem' }}>
        Showing <span style={{ color: '#fff', fontWeight: '500' }}>{startItem}-{endItem}</span> of{' '}
        <span style={{ color: '#fff', fontWeight: '500' }}>{totalItems}</span> results
      </div>

      {/* Page numbers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: currentPage === 1 ? '#1a1a1a' : '#222',
            color: currentPage === 1 ? '#555' : '#fff',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}
        >
          Previous
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span style={{ padding: '0.5rem', color: '#666', fontSize: '0.875rem' }}>...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: currentPage === page ? '#6366f1' : '#222',
                  color: currentPage === page ? '#fff' : '#999',
                  border: `1px solid ${currentPage === page ? '#6366f1' : '#333'}`,
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: currentPage === page ? '600' : '500',
                  minWidth: '2.5rem',
                }}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: currentPage === totalPages ? '#1a1a1a' : '#222',
            color: currentPage === totalPages ? '#555' : '#fff',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}
        >
          Next
        </button>
      </div>

      {/* Page size selector */}
      {showPageSize && onPageSizeChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#666', fontSize: '0.875rem' }}>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: '#222',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}




