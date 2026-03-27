import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Fund } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Edit2, Trash2, X, Check, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

export const Funds = () => {
  const { isAdmin } = useAuth();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newFundName, setNewFundName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [deleteFund, setDeleteFund] = useState<{id: string, name: string} | null>(null);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funds'), (snapshot) => {
      const fundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fund));
      setFunds(fundsData.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFundName.trim()) return;
    setConfirmAdd(true);
  };

  const executeAddFund = async () => {
    try {
      await addDoc(collection(db, 'funds'), {
        name: newFundName.trim(),
        balance: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setNewFundName('');
      setIsAdding(false);
      toast.success('Thêm quỹ thành công');
    } catch (error) {
      toast.error('Lỗi khi thêm quỹ');
    } finally {
      setConfirmAdd(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteFund) return;
    try {
      await deleteDoc(doc(db, 'funds', deleteFund.id));
      toast.success('Đã xóa quỹ');
    } catch (error) {
      toast.error('Lỗi khi xóa quỹ');
    } finally {
      setDeleteFund(null);
    }
  };

  const handleEdit = (fund: Fund) => {
    setEditingId(fund.id);
    setEditName(fund.name);
  };

  const handleUpdateClick = (id: string) => {
    if (!editName.trim()) return;
    setConfirmEdit(id);
  };

  const executeUpdate = async () => {
    if (!confirmEdit || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'funds', confirmEdit), {
        name: editName.trim(),
        updatedAt: Date.now()
      });
      setEditingId(null);
      toast.success('Cập nhật tên quỹ thành công');
    } catch (error) {
      toast.error('Lỗi khi cập nhật quỹ');
    } finally {
      setConfirmEdit(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
    </div>;
  }

  const totalBalance = funds.reduce((sum, f) => sum + f.balance, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Quỹ</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tổng số dư tất cả các quỹ: <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalBalance)}</span></p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Thêm quỹ mới
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-semibold mb-4">Thêm quỹ mới</h2>
          <form onSubmit={handleAddFund} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newFundName}
              onChange={(e) => setNewFundName(e.target.value)}
              placeholder="Tên quỹ (VD: Tiền mặt, Vietcombank...)"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newFundName.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Tên quỹ</th>
                <th className="px-6 py-4 text-right">Số dư</th>
                <th className="px-6 py-4">Ngày tạo</th>
                {isAdmin && <th className="px-6 py-4 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {editingId === fund.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full max-w-xs"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateClick(fund.id)}
                      />
                    ) : (
                      fund.name
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(fund.balance)}
                  </td>
                  <td className="px-6 py-4">
                    {formatDate(fund.createdAt)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      {editingId === fund.id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleUpdateClick(fund.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Lưu">
                            <Check size={18} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Hủy">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(fund)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Sửa">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => setDeleteFund({ id: fund.id, name: fund.name })} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xóa">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {funds.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Wallet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p>Chưa có quỹ nào. Hãy tạo quỹ đầu tiên của bạn.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteFund}
        title="Xác nhận xóa quỹ"
        message={`Bạn có chắc chắn muốn xóa quỹ "${deleteFund?.name}"? Các giao dịch liên quan có thể bị ảnh hưởng.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteFund(null)}
      />

      <ConfirmModal
        isOpen={confirmAdd}
        title="Xác nhận thêm quỹ"
        message={`Bạn có chắc chắn muốn thêm quỹ "${newFundName.trim()}" không?`}
        onConfirm={executeAddFund}
        onCancel={() => setConfirmAdd(false)}
      />

      <ConfirmModal
        isOpen={!!confirmEdit}
        title="Xác nhận cập nhật"
        message={`Bạn có chắc chắn muốn cập nhật tên quỹ thành "${editName.trim()}" không?`}
        onConfirm={executeUpdate}
        onCancel={() => setConfirmEdit(null)}
      />
    </div>
  );
};
