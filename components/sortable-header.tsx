'use client';

import { useMemo, useState } from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowUp, ArrowDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';
export type SortAccessor<T> = (item: T) => string | number | null | undefined;

export function useSort<T>(items: T[], accessors: Record<string, SortAccessor<T>>, initialKey: string | null = null, initialDirection: SortDirection = 'asc') {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('asc');
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    const accessor = accessors[sortKey];
    if (!accessor) return items;

    const sorted = [...items].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return av - bv;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', { sensitivity: 'base' });
    });

    return direction === 'asc' ? sorted : sorted.reverse();
  }, [items, sortKey, direction, accessors]);

  return { sortKey, direction, toggleSort, sortedItems };
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function SortableHeader({ label, sortKey, currentSortKey, direction, onSort, className, align = 'left' }: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-semibold select-none whitespace-nowrap ${
          align === 'right' ? 'w-full justify-end text-right' : ''
        } ${isActive ? 'underline decoration-2 underline-offset-4' : ''}`}
      >
        {label}
        {isActive && (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}