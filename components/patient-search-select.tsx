'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PatientBasic {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  consecutiveNoShows?: number;
}

interface PatientSearchSelectProps {
  patients: PatientBasic[];
  value?: string;
  onSelect: (patientId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  resetKey?: string | number;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function PatientSearchSelect({
  patients,
  value,
  onSelect,
  placeholder = 'Sélectionner un patient',
  disabled = false,
  className,
  resetKey,
}: PatientSearchSelectProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setSearch('');
    setOpen(false);
  }

  const validPatients = useMemo(() => uniqueById(patients), [patients]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return validPatients;
    return validPatients.filter((p) => {
      const haystack = `${p.firstName} ${p.lastName}`.toLowerCase() + (p.email || '').toLowerCase();
      return haystack.includes(q);
    });
  }, [validPatients, search]);

  const selected = validPatients.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selected ? (
            <span className={cn(
              'truncate min-w-0 text-left',
              (selected.consecutiveNoShows ?? 0) >= 3 ? 'text-red-600 font-bold' :
              (selected.consecutiveNoShows ?? 0) >= 2 ? 'text-orange-500 font-bold' : ''
            )}>
              {selected.firstName} {selected.lastName}
            </span>
          ) : <span className="truncate min-w-0 text-left text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Rechercher un patient..."
            value={search}
            onValueChange={setSearch}
            disabled={validPatients.length === 0}
          />
          <CommandList>
            {validPatients.length === 0 ? (
              <CommandEmpty className="py-4 text-sm text-gray-500">
                Aucun patient disponible.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredPatients.length === 0 ? (
                  <CommandEmpty className="py-4 text-sm text-gray-500">
                    Aucun patient ne correspond.
                  </CommandEmpty>
                ) : (
                  filteredPatients.map((patient) => (
                    <CommandItem
                      key={patient.id}
                      value={`${patient.firstName} ${patient.lastName}`}
                      onSelect={() => {
                        onSelect(patient.id);
                        setSearch('');
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4 shrink-0',
                          value === patient.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className={
                        (patient.consecutiveNoShows ?? 0) >= 3 ? 'text-red-600 font-bold' :
                        (patient.consecutiveNoShows ?? 0) >= 2 ? 'text-orange-500 font-bold' : ''
                      }>
                        {patient.firstName} {patient.lastName}
                      </span>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
