'use client';

import { useMemo, useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page: safePage,
    setPage: (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    totalPages,
    totalItems: items.length,
    paginatedItems,
  };
}

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ page, totalPages, totalItems, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-4">
      <p className="text-sm text-gray-500 hidden sm:block">
        {totalItems} résultat{totalItems > 1 ? 's' : ''}
      </p>
      <Pagination className="w-auto mx-0">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }}
              className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          <PaginationItem className="flex sm:hidden">
            <span className="px-2 text-sm text-gray-500">Page {page} / {totalPages}</span>
          </PaginationItem>
          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`e-${idx}`} className="hidden sm:flex">
                <span className="flex size-9 items-center justify-center text-sm text-gray-400">...</span>
              </PaginationItem>
            ) : (
              <PaginationItem key={p} className="hidden sm:flex">
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => { e.preventDefault(); onPageChange(p); }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
