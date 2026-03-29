import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, writeBatch, doc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Fund, TransactionType, PredefinedNote } from '../types';
import { formatCurrency } from '../lib/utils';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface TransactionRow {
  id: string;
  note: string;
  amount: string;
  fundId: string;
}

interface TransactionFormProps {
  type: TransactionType;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ type }) => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [predefinedNotes, setPredefinedNotes] = useState<PredefinedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const createEmptyRow = (): TransactionRow => ({
    id: Math.random().toString(36).substr(2, 9),
    note: '',
    amount: '',
    fundId: ''
  });

  const [rows, setRows] = useState<TransactionRow[]>([createEmptyRow()]);

  useEffect(() => {
    const unsubFunds = onSnapshot(collection(db, 'funds'), (snapshot) => {
      const fundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fund));
      setFunds(fundsData);
      
      // Auto-select first fund if available and no fund selected
      if (fundsData.length > 0) {
        setRows(prev => prev.map(row => row.fundId === '' ? { ...row, fundId: fundsData[0].id } : row));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching funds:", error);
      toast.error("Không thể tải danh sách quỹ");
      setLoading(false);
    });

    const unsubNotes = onSnapshot(collection(db, 'predefinedNotes'), (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PredefinedNote));
      setPredefinedNotes(notesData.filter(n => n.type === type || n.type === 'both').sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Error fetching predefined notes:", error);
    });

    return () => {
      unsubFunds();
      unsubNotes();
    };
  }, [type]);

  const handleAddRow = () => {
    setRows([...rows, { ...createEmptyRow(), fundId: funds.length > 0 ? funds[0].id : '' }]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) return; // Keep at least one row
    setRows(rows.filter(row => row.id !== id));
  };

  const handleChange = (id: string, field: keyof TransactionRow, value: string) => {
    // Auto format currency for amount
    if (field === 'amount') {
      // Remove non-numeric chars
      const numericValue = value.replace(/\D/g, '');
      setRows(rows.map(row => row.id === id ? { ...row, [field]: numericValue } : row));
    } else {
      setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (funds.length === 0) {
      toast.error('Vui lòng tạo quỹ trước khi giao dịch');
      return;
    }

    // Validate rows
    const validRows = rows.filter(row => row.note.trim() && row.amount && Number(row.amount) > 0 && row.fundId);
    
    if (validRows.length === 0) {
      toast.error('Vui lòng điền đầy đủ thông tin ít nhất 1 dòng');
      return;
    }

    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    const validRows = rows.filter(row => row.note.trim() && row.amount && Number(row.amount) > 0 && row.fundId);
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const batchId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const baseTime = Date.now();
      
      // Aggregate balance changes and track running balance per fund
      const fundChanges: Record<string, number> = {};
      const fundRunningBalances: Record<string, number> = {};
      
      // Initialize running balances with current fund balances
      funds.forEach(f => {
        fundRunningBalances[f.id] = f.balance;
      });
      
      validRows.forEach((row, index) => {
        const amountNum = Number(row.amount);
        const fund = funds.find(f => f.id === row.fundId);
        
        // Ensure each row has a slightly different timestamp to preserve order
        const rowTime = baseTime + index;
        
        // Update running balance for this fund
        const balanceChange = type === 'income' ? amountNum : -amountNum;
        fundRunningBalances[row.fundId] = (fundRunningBalances[row.fundId] || 0) + balanceChange;
        
        // 1. Create transaction doc
        const txRef = doc(collection(db, 'transactions'));
        const txData: any = {
          type,
          amount: amountNum,
          date: rowTime, // Unique timestamp
          note: row.note.trim(),
          fundId: row.fundId,
          fundName: fund?.name || 'Unknown',
          balanceAfter: fundRunningBalances[row.fundId],
          createdAt: rowTime, // Unique timestamp
          createdBy: user?.email || 'Unknown'
        };
        
        if (validRows.length > 1) {
          txData.batchId = batchId;
        }
        
        batch.set(txRef, txData);

        // 2. Aggregate fund balance changes
        fundChanges[row.fundId] = (fundChanges[row.fundId] || 0) + balanceChange;
      });

      // Apply aggregated fund balance changes
      Object.entries(fundChanges).forEach(([fundId, change]) => {
        if (change !== 0) {
          const fundRef = doc(db, 'funds', fundId);
          batch.set(fundRef, {
            balance: increment(change),
            updatedAt: Date.now()
          }, { merge: true });
        }
      });

      await batch.commit();
      toast.success(`Đã lưu ${validRows.length} giao dịch thành công`);
      
      // Reset form
      setRows([{ ...createEmptyRow(), fundId: funds[0].id }]);
    } catch (error: any) {
      console.error('Lỗi khi lưu giao dịch:', error);
      toast.error(`Lỗi khi lưu giao dịch: ${error.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  const totalAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  // Calculate projected balance for each row
  const getProjectedBalance = (rowIndex: number, fundId: string) => {
    const fund = funds.find(f => f.id === fundId);
    if (!fund) return 0;
    let balance = fund.balance;
    for (let i = 0; i <= rowIndex; i++) {
      if (rows[i].fundId === fundId) {
        const rowAmt = Number(rows[i].amount) || 0;
        balance += type === 'income' ? rowAmt : -rowAmt;
      }
    }
    return balance;
  };

  if (loading || authLoading) return <div>Đang tải...</div>;
  if (!can('canAddTransaction')) return <Navigate to="/" replace />;

  const isIncome = type === 'income';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isIncome ? 'Nhập Quỹ (Thu)' : 'Xuất Quỹ (Chi)'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Tổng tiền: <span className={`font-bold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(totalAmount)}
            </span>
          </p>
        </div>
      </div>

      <form onSubmit={handlePreSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3 min-w-[200px]">Nội dung / Ghi chú</th>
                <th className="px-4 py-3 w-40">Số tiền (VNĐ)</th>
                <th className="px-4 py-3 w-48">Quỹ</th>
                <th className="px-4 py-3 w-40">Số dư cuối</th>
                <th className="px-4 py-3 w-16 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const projectedBalance = getProjectedBalance(index, row.fundId);
                return (
                  <tr key={row.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {predefinedNotes.length > 0 && (
                          <select
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const currentNote = row.note.trim();
                              // Check if already contains
                              if (currentNote.includes(val)) {
                                e.target.value = '';
                                return;
                              }
                              const newNote = currentNote ? `${currentNote}, ${val}` : val;
                              handleChange(row.id, 'note', newNote);
                              e.target.value = '';
                            }}
                          >
                            <option value="">-- Chọn nội dung mẫu --</option>
                            {predefinedNotes.map(note => (
                              <option key={note.id} value={note.content}>{note.content}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          required
                          value={row.note}
                          onChange={(e) => handleChange(row.id, 'note', e.target.value)}
                          placeholder="VD: Thu tiền bán hàng..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={row.amount ? new Intl.NumberFormat('vi-VN').format(Number(row.amount)) : ''}
                          onChange={(e) => handleChange(row.id, 'amount', e.target.value)}
                          placeholder="0"
                          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        required
                        value={row.fundId}
                        onChange={(e) => handleChange(row.id, 'fundId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="" disabled>Chọn quỹ</option>
                        {funds.map(fund => (
                          <option key={fund.id} value={fund.id}>{fund.name} ({formatCurrency(fund.balance)})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {row.fundId ? formatCurrency(projectedBalance) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={rows.length === 1}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors w-full sm:w-auto justify-center"
          >
            <Plus size={20} className="mr-2" />
            Thêm dòng
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || funds.length === 0}
            className={`flex items-center px-8 py-2.5 text-white rounded-lg transition-colors w-full sm:w-auto justify-center shadow-sm ${
              isIncome 
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2`}
          >
            <Save size={20} className="mr-2" />
            {isSubmitting ? 'Đang lưu...' : `Lưu ${rows.length} giao dịch`}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showConfirm}
        title="Xác nhận lưu giao dịch"
        message={`Bạn có chắc chắn muốn lưu ${rows.filter(row => row.note.trim() && row.amount && Number(row.amount) > 0 && row.fundId).length} giao dịch này không?`}
        onConfirm={confirmSubmit}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};

export const Income = () => <TransactionForm type="income" />;
export const Expense = () => <TransactionForm type="expense" />;
