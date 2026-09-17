'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date-range' | 'number-range' | 'checkbox';
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: string | { from?: string; to?: string } | { min?: number; max?: number } | undefined;
}

interface FilterDialogProps {
  fields: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset: () => void;
}

export function countActiveFilters(fields: FilterField[], values: FilterValues): number {
  return fields.reduce((count, field) => {
    const value = values[field.key];
    if (value === undefined || value === null || value === '') return count;

    if (typeof value === 'object') {
      const obj = value as { from?: string; to?: string; min?: number; max?: number };
      const hasValue = (obj.from !== undefined && obj.from !== '') || (obj.to !== undefined && obj.to !== '');
      const hasNumber = (obj.min !== undefined && obj.min !== null && !Number.isNaN(Number(obj.min))) ||
        (obj.max !== undefined && obj.max !== null && !Number.isNaN(Number(obj.max)));
      if (!hasValue && !hasNumber) return count;
    }

    return count + 1;
  }, 0);
}

export function resetFilters(fields: FilterField[]): FilterValues {
  const empty: FilterValues = {};
  for (const field of fields) {
    if (field.type === 'date-range') empty[field.key] = { from: '', to: '' };
    else if (field.type === 'number-range') empty[field.key] = { min: undefined, max: undefined };
    else empty[field.key] = '';
  }
  return empty;
}

export default function FilterDialog({ fields, values, onChange, onReset }: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValues>(values);

  useEffect(() => {
    setDraft(values);
  }, [values]);

  const activeCount = countActiveFilters(fields, values);

  function updateDraft(key: string, value: string | { from?: string; to?: string; min?: number; max?: number }) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onChange(draft);
    setOpen(false);
  }

  function handleReset() {
    setDraft(resetFilters(fields));
    onChange(resetFilters(fields));
    setOpen(false);
  }

  function isActive() {
    return activeCount > 0;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen((prev) => !prev)}
        className="gap-2"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtres
        {isActive() && (
          <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs">
            {activeCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="basis-full w-full mt-3 border rounded-lg p-4 bg-card shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {fields.map((field) => {
              const value = draft[field.key];

              if (field.type === 'select') {
                return (
                  <Field key={field.key}>
                    <FieldLabel>{field.label}</FieldLabel>
                    <Select
                      value={(value as string) || ''}
                      onValueChange={(v) => updateDraft(field.key, v === '__all__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Tous</SelectItem>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              }

              if (field.type === 'date-range') {
                const dateValue = (value as { from?: string; to?: string }) || { from: '', to: '' };
                return (
                  <Field key={field.key}>
                    <FieldLabel>{field.label}</FieldLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={dateValue.from || ''}
                        onChange={(e) => updateDraft(field.key, { ...dateValue, from: e.target.value })}
                        placeholder="Du"
                      />
                      <Input
                        type="date"
                        value={dateValue.to || ''}
                        onChange={(e) => updateDraft(field.key, { ...dateValue, to: e.target.value })}
                        placeholder="Au"
                      />
                    </div>
                  </Field>
                );
              }

              if (field.type === 'number-range') {
                const numValue = (value as { min?: number; max?: number }) || { min: undefined, max: undefined };
                return (
                  <Field key={field.key}>
                    <FieldLabel>{field.label}</FieldLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={numValue.min ?? ''}
                        onChange={(e) => updateDraft(field.key, { ...numValue, min: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="Min"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={numValue.max ?? ''}
                        onChange={(e) => updateDraft(field.key, { ...numValue, max: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="Max"
                      />
                    </div>
                  </Field>
                );
              }

              if (field.type === 'checkbox') {
                return (
                  <div key={field.key} className="flex items-center gap-2 pt-0 md:pt-6">
                    <Checkbox
                      id={field.key}
                      checked={value === 'true'}
                      onCheckedChange={(checked) => updateDraft(field.key, checked ? 'true' : '')}
                    />
                    <label htmlFor={field.key} className="text-sm font-medium cursor-pointer">{field.label}</label>
                  </div>
                );
              }

              // text
              return (
                <Field key={field.key}>
                  <FieldLabel>{field.label}</FieldLabel>
                  <Input
                    type="text"
                    value={(value as string) || ''}
                    onChange={(e) => updateDraft(field.key, e.target.value)}
                    placeholder={field.placeholder || `Filtrer par ${field.label.toLowerCase()}`}
                  />
                </Field>
              );
            })}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center pt-4 mt-4 border-t">
            <Button variant="ghost" onClick={handleReset} className="gap-2 w-full sm:w-auto text-red-600 hover:text-red-700">
              <X className="h-4 w-4" />
              Réinitialiser
            </Button>
            <Button onClick={handleApply} className="gap-2 w-full sm:w-auto">
              Appliquer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
