import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { Navigate } from 'react-router-dom';
import { Bell, Plus, Trash2, Send, AppWindow, Info, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'regular' | 'app_open';
  createdAt: number;
  createdBy: string;
  creatorName: string;
  isActive: boolean;
}

export const NotificationAdmin = () => {
  const { user, isAdmin } = useAuth();
  const { can } = usePermissions();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);

  const [newNotification, setNewNotification] = useState({
    title: '',
    content: '',
    type: 'regular' as 'regular' | 'app_open'
  });

  useEffect(() => {
    if (!can('canManageNotifications')) return;

    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [can]);

  if (!can('canManageNotifications')) {
    return <Navigate to="/" replace />;
  }

  const handleAddNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotification.title || !newNotification.content) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      // If it's an app_open notification, deactivate others of the same type
      if (newNotification.type === 'app_open') {
        const activeAppOpen = notifications.filter(n => n.type === 'app_open' && n.isActive);
        for (const n of activeAppOpen) {
          await updateDoc(doc(db, 'notifications', n.id), { isActive: false });
        }
      }

      await addDoc(collection(db, 'notifications'), {
        ...newNotification,
        createdAt: Date.now(),
        createdBy: user?.uid,
        creatorName: user?.displayName || user?.email,
        isActive: true
      });

      toast.success('Đã đăng thông báo thành công');
      setIsAdding(false);
      setNewNotification({ title: '', content: '', type: 'regular' });
      
      // Trigger PWA notification if regular
      if (newNotification.type === 'regular' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(newNotification.title, {
          body: newNotification.content,
          icon: 'https://hdd.io.vn/img/bmassloadings.png'
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi đăng thông báo');
    }
  };

  const toggleActive = async (notification: Notification) => {
    try {
      // If activating an app_open notification, deactivate others
      if (!notification.isActive && notification.type === 'app_open') {
        const activeAppOpen = notifications.filter(n => n.type === 'app_open' && n.isActive);
        for (const n of activeAppOpen) {
          await updateDoc(doc(db, 'notifications', n.id), { isActive: false });
        }
      }

      await updateDoc(doc(db, 'notifications', notification.id), {
        isActive: !notification.isActive
      });
      toast.success(`Đã ${!notification.isActive ? 'kích hoạt' : 'tạm dừng'} thông báo`);
    } catch (error) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDelete = async () => {
    if (!notificationToDelete) return;
    try {
      await deleteDoc(doc(db, 'notifications', notificationToDelete.id));
      toast.success('Đã xóa thông báo');
    } catch (error) {
      toast.error('Lỗi khi xóa thông báo');
    } finally {
      setNotificationToDelete(null);
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell className="text-blue-600" />
          Quản lý thông báo
        </h1>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isAdding ? <XCircle size={20} /> : <Plus size={20} />}
          {isAdding ? 'Hủy' : 'Đăng thông báo mới'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAddNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nhập tiêu đề thông báo..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Loại thông báo</label>
                <select
                  value={newNotification.type}
                  onChange={(e) => setNewNotification({ ...newNotification, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="regular">Thông báo đẩy (PWA)</option>
                  <option value="app_open">Thông báo khi mở App (Popup)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nội dung</label>
              <textarea
                value={newNotification.content}
                onChange={(e) => setNewNotification({ ...newNotification, content: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nhập nội dung chi tiết..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send size={18} />
                Đăng ngay
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {notifications.map((n) => (
          <div 
            key={n.id} 
            className={`bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm transition-all ${
              n.isActive ? 'border-blue-100 dark:border-blue-900/30' : 'border-gray-100 dark:border-gray-700 opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  n.type === 'app_open' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {n.type === 'app_open' ? <AppWindow size={20} /> : <Bell size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{n.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      n.type === 'app_open' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {n.type === 'app_open' ? 'Khi mở App' : 'Thông báo đẩy'}
                    </span>
                    {!n.isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-gray-100 text-gray-600">
                        Đã tạm dừng
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mb-3">{n.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <Info size={12} /> {n.creatorName}
                    </span>
                    <span>{format(n.createdAt, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(n)}
                  className={`p-2 rounded-lg transition-colors ${
                    n.isActive 
                      ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                      : 'text-green-600 bg-green-50 hover:bg-green-100'
                  }`}
                  title={n.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                >
                  {n.isActive ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                </button>
                <button
                  onClick={() => setNotificationToDelete(n)}
                  className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  title="Xóa"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <Bell size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Chưa có thông báo nào được đăng</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!notificationToDelete}
        onCancel={() => setNotificationToDelete(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa thông báo"
        message={`Bạn có chắc chắn muốn xóa thông báo "${notificationToDelete?.title}" không?`}
      />
    </div>
  );
};
