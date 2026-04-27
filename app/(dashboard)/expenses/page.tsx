'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { expenses } from '@/lib/api';
import ExpenseForm, { type ExpenseFormData } from '@/components/expense-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Charges et dépenses</h1>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Charges et dépenses</h1>
            <p className="text-gray-600 mt-1">Suivi des dépenses et charges du cabinet</p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {expensesList.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Charges et dépenses ({expensesList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesList.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell>
                        {expense.category ? (
                          <Badge variant="outline">{expense.category}</Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{Number(expense.amount).toFixed(2)} DZD</TableCell>
                      <TableCell>{new Date(expense.expenseDate).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{expense.createdByName || '—'}</TableCell>
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
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-emerald-800">Total des dépenses</span>
                  <span className="text-xl font-bold text-emerald-700">
                    {expensesList.reduce((sum, exp) => sum + Number(exp.amount), 0).toFixed(2)} DZD
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Aucune dépense trouvée</p>
              <Button
                onClick={openCreateDialog}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
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
