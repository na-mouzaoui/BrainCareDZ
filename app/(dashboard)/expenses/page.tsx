'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { expenses } from '@/lib/api';
import ExpenseForm, { type ExpenseFormData } from '@/components/expense-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { usePagination, PaginationControls } from '@/components/pagination-controls';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { ListPageSkeleton } from '@/components/page-skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FilterDialog, {
  type FilterField,
  type FilterValues,
  resetFilters,
} from '@/components/filter-dialog';
import { useSort, SortableHeader } from '@/components/sortable-header';

interface Expense {
  id: string;
  title: string;
  category?: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  createdAt: string;
  createdByName?: string;
}

export default function expensesPage() {
  const [expensesList, setExpensesList] = useState<Expense[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const filterFields: FilterField[] = [
    { key: 'title', label: 'Libellé', type: 'text', placeholder: 'Libellé de la dépense' },
    { key: 'category', label: 'Catégorie', type: 'text', placeholder: 'Catégorie' },
    { key: 'createdByName', label: 'Créé par', type: 'text', placeholder: 'Nom de l\'utilisateur' },
    { key: 'amount', label: 'Montant (DZD)', type: 'number-range' },
    { key: 'dateRange', label: 'Date de la dépense', type: 'date-range' },
  ];

  const filteredExpensesList = useMemo(() => {
    return expensesList.filter((expense) => {
      for (const [key, rawValue] of Object.entries(filters)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (typeof rawValue === 'object') {
          const range = rawValue as { from?: string; to?: string; min?: number; max?: number };

          if (key === 'amount') {
            const amount = Number(expense.amount) || 0;
            if (range.min !== undefined && !Number.isNaN(range.min) && amount < range.min) return false;
            if (range.max !== undefined && !Number.isNaN(range.max) && amount > range.max) return false;
          }

          if (key === 'dateRange') {
            const time = new Date(expense.expenseDate).getTime();
            const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
            const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;
            if (from !== null && time < from) return false;
            if (to !== null && time > to) return false;
          }

          continue;
        }

        const value = String(rawValue).toLowerCase();
        if (key === 'title' && !(expense.title || '').toLowerCase().includes(value)) return false;
        if (key === 'category' && !(expense.category || '').toLowerCase().includes(value)) return false;
        if (key === 'createdByName' && !(expense.createdByName || '').toLowerCase().includes(value)) return false;
      }

      return true;
    });
  }, [expensesList, filters]);

  const { sortKey, direction, toggleSort, sortedItems } = useSort(
    filteredExpensesList,
    {
      title: (e) => e.title,
      category: (e) => e.category || '',
      amount: (e) => Number(e.amount) || 0,
      date: (e) => e.expenseDate || '',
      createdByName: (e) => e.createdByName || '',
    },
    'date'
  );

  const { page, setPage, totalPages, totalItems, paginatedItems } = usePagination(sortedItems);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    if (!authLoading && isAuthenticated && user?.role === 'admin') {
      loadExpenses();
    }
  }, [isAuthenticated, authLoading, router, user]);

  async function loadExpenses() {
    try {
      setIsLoading(true);
      const response = await expenses.getAll();
      if (response.success && response.data) {
        setExpensesList(response.data.expenses || []);
      } else {
        setError(response.message || 'Échec du chargement des dépenses');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors du chargement des dépenses');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(expenseId: string) {
    if (!confirm('Voulez-vous vraiment supprimer cette dépense ?')) {
      return;
    }

    try {
      const response = await expenses.delete(expenseId);
      if (response.success) {
        await loadExpenses();
      } else {
        setError(response.message || 'Échec de la suppression de la dépense');
      }
    } catch (err) {
      setError('Une erreur s\'est produite lors de la suppression de la dépense');
    }
  }

  async function handleCreateExpense(data: ExpenseFormData) {
    const response = await expenses.create(data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la création de la dépense');
    }
    setCreateOpen(false);
    await loadExpenses();
  }

  async function handleUpdateExpense(data: ExpenseFormData) {
    if (!editingExpense) return;
    const response = await expenses.update(editingExpense.id, data);
    if (!response.success) {
      throw new Error(response.message || 'Échec de la modification de la dépense');
    }
    setCreateOpen(false);
    setEditingExpense(null);
    await loadExpenses();
  }

  function openCreateDialog() {
    setEditingExpense(null);
    setCreateOpen(true);
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense);
    setCreateOpen(true);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setCreateOpen(nextOpen);
    if (!nextOpen) {
      setEditingExpense(null);
    }
  }

  if (authLoading || isLoading) {
    return <ListPageSkeleton />;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-4">
        <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Charges et dépenses</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Accès réservé aux administrateurs.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Charges et dépenses</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={openCreateDialog}
              className="gap-2 bg-brand-700 hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              Nouvelle dépense
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8 w-full">
        <FilterDialog
          fields={filterFields}
          values={filters}
          onChange={setFilters}
          onReset={() => setFilters(resetFilters(filterFields))}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {filteredExpensesList.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Charges et dépenses ({totalItems})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Libellé" sortKey="title" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Catégorie" sortKey="category" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Montant" sortKey="amount" currentSortKey={sortKey} direction={direction} onSort={toggleSort} />
                    <SortableHeader label="Date" sortKey="date" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Créé par" sortKey="createdByName" currentSortKey={sortKey} direction={direction} onSort={toggleSort} className="hidden lg:table-cell" />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.title}
                        <span className="md:hidden mt-1 block text-xs font-normal text-gray-500">
                          {expense.category && <span className="block">{expense.category}</span>}
                          <span className="block">{new Date(expense.expenseDate).toLocaleDateString('fr-FR')}</span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {expense.category ? (
                          <Badge variant="outline">{expense.category}</Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{Number(expense.amount).toFixed(2)} DZD</TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(expense.expenseDate).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="hidden lg:table-cell">{expense.createdByName || '—'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(expense)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(expense.id)}
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 p-4 bg-brand-50 rounded-lg border border-brand-200">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                  <span className="text-lg font-semibold text-brand-800">Total des dépenses</span>
                  <span className="text-xl font-bold text-brand-700">
                    {filteredExpensesList.reduce((sum, exp) => sum + Number(exp.amount), 0).toFixed(2)} DZD
                  </span>
                </div>
              </div>
            </div>
            <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Aucune dépense trouvée</p>
              <Button
                onClick={openCreateDialog}
                className="gap-2 bg-brand-700 hover:bg-brand-800"
              >
                <Plus className="h-4 w-4" />
                Nouvelle dépense
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}</DialogTitle>
            <DialogDescription>Renseignez les détails de la dépense.</DialogDescription>
          </DialogHeader>
          <ExpenseForm
            onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense}
            submitButtonText={editingExpense ? 'Mettre à jour' : 'Enregistrer la dépense'}
            initialData={
              editingExpense
                ? {
                    title: editingExpense.title,
                    category: editingExpense.category,
                    amount: Number(editingExpense.amount),
                    expenseDate: editingExpense.expenseDate?.slice(0, 10) || '',
                    notes: editingExpense.notes || '',
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
