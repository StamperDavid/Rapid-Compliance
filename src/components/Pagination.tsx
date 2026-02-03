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
        for (let i = 1; i <= 5; i++) {pages.push(i);}
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {pages.push(i);}
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {pages.push(i);}
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
      backgroundColor: 'var(--color-bg-paper)',
      borderTop: '1px solid var(--color-bg-elevated)',
      borderRadius: '0 0 0.75rem 0.75rem',
    }}>
      {/* Results info */}
      <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
        Showing <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>{startItem}-{endItem}</span> of{' '}
        <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>{totalItems}</span> results
      </div>

      {/* Page numbers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: currentPage === 1 ? 'var(--color-bg-elevated)' : 'var(--color-bg-elevated)',
            color: currentPage === 1 ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
            border: '1px solid var(--color-border-light)',
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
              <span style={{ padding: '0.5rem', color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: currentPage === page ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: currentPage === page ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: `1px solid ${currentPage === page ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
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
            backgroundColor: currentPage === totalPages ? 'var(--color-bg-elevated)' : 'var(--color-bg-elevated)',
            color: currentPage === totalPages ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
            border: '1px solid var(--color-border-light)',
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
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-light)',
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













