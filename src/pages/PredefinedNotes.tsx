import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PredefinedNote, TransactionType } from '../types';
import { Plus, Trash2, Save, Edit2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ConfirmModal } from '../components/ConfirmModal';

export const PredefinedNotes = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<PredefinedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<TransactionType | 'both'>('both');

  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<TransactionType | 'both'>('both');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'predefinedNotes'), (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PredefinedNote));
      setNotes(notesData.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching predefined notes:", error);
      toast.error("Không thể tải danh sách ghi chú");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setConfirmAdd(true);
  };

  const executeAdd = async () => {
    try {
      const newNoteRef = doc(collection(db, 'predefinedNotes'));
      await setDoc(newNoteRef, {
        content: newContent.trim(),
        type: newType,
        createdAt: Date.now()
      });
      setNewContent('');
      setNewType('both');
      toast.success('Đã thêm ghi chú mẫu');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thêm ghi chú');
    } finally {
      setConfirmAdd(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'predefinedNotes', deleteId));
      toast.success('Đã xóa ghi chú');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa ghi chú');
    } finally {
      setDeleteId(null);
    }
  };

  const startEdit = (note: PredefinedNote) => {
    setIsEditing(note.id);
    setEditContent(note.content);
    setEditType(note.type);
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setEditContent('');
    setEditType('both');
  };

  const handleSaveEditClick = (id: string) => {
    if (!editContent.trim()) return;
    setConfirmEdit(id);
  };

  const executeEdit = async () => {
    if (!confirmEdit || !editContent.trim()) return;
    try {
      await setDoc(doc(db, 'predefinedNotes', confirmEdit), {
        content: editContent.trim(),
        type: editType,
        updatedAt: Date.now()
      }, { merge: true });
      toast.success('Đã cập nhật ghi chú');
      cancelEdit();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật ghi chú');
    } finally {
      setConfirmEdit(null);
    }
  };

  // if (!isAdmin) return <Navigate to="/" replace />;
  if (loading || authLoading) return <div>Đang tải...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Ghi chú mẫu</h1>
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Thêm ghi chú mới</h2>
          <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Nội dung ghi chú..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TransactionType | 'both')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="both">Dùng chung</option>
              <option value="income">Chỉ dùng cho Thu</option>
              <option value="expense">Chỉ dùng cho Chi</option>
            </select>
            <button
              type="submit"
              disabled={!newContent.trim()}
              className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Thêm
            </button>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-4">Nội dung</th>
              <th className="px-6 py-4 w-40">Loại</th>
              {isAdmin && <th className="px-6 py-4 w-32 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Chưa có ghi chú mẫu nào
                </td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr key={note.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    {isEditing === note.id ? (
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEditClick(note.id)}
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">{note.content}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing === note.id ? (
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as TransactionType | 'both')}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="both">Dùng chung</option>
                        <option value="income">Thu</option>
                        <option value="expense">Chi</option>
                      </select>
                    ) : (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        note.type === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        note.type === 'expense' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {note.type === 'income' ? 'Chỉ Thu' : note.type === 'expense' ? 'Chỉ Chi' : 'Dùng chung'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      {isEditing === note.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSaveEditClick(note.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Lưu"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Hủy"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(note)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteId(note.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa ghi chú mẫu này không?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmModal
        isOpen={confirmAdd}
        title="Xác nhận thêm ghi chú"
        message={`Bạn có chắc chắn muốn thêm ghi chú "${newContent.trim()}" không?`}
        onConfirm={executeAdd}
        onCancel={() => setConfirmAdd(false)}
      />

      <ConfirmModal
        isOpen={!!confirmEdit}
        title="Xác nhận cập nhật"
        message={`Bạn có chắc chắn muốn cập nhật ghi chú thành "${editContent.trim()}" không?`}
        onConfirm={executeEdit}
        onCancel={() => setConfirmEdit(null)}
      />
    </div>
  );
};
