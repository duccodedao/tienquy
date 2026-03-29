import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon, Lock, Unlock, Trash2, Plus, Eye, Edit, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';
import { usePermissions } from '../contexts/PermissionsContext';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  role?: string;
  adminRequested?: boolean;
  isLocked?: boolean;
  lastLogin?: number;
  lastIP?: string;
}

export const AdminManagement = () => {
  const { user: currentUser, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const { permissions, updatePermissions, can } = usePermissions();
  const [users, setUsers] = useState<UserData[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState('');
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch users
    const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      toast.error("Không thể tải danh sách người dùng");
      setLoading(false);
    });

    // Fetch blocked IPs
    const unsubscribeIPs = onSnapshot(doc(db, 'settings', 'security'), (snapshot) => {
      if (snapshot.exists()) {
        setBlockedIPs(snapshot.data().blockedIPs || []);
      } else {
        setDoc(doc(db, 'settings', 'security'), { blockedIPs: [] });
      }
    }, (error) => {
      console.error("Error fetching blocked IPs:", error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeIPs();
    };
  }, [isAdmin]);

  if (authLoading) return <div>Đang tải...</div>;
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const toggleAdminRole = async (userId: string, currentRole?: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateDoc(userRef, { 
        role: newRole,
        adminRequested: false // Reset request status when action is taken
      });
      toast.success(`Đã ${newRole === 'admin' ? 'cấp' : 'thu hồi'} quyền Admin`);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi cập nhật quyền');
      console.error(error);
    }
  };

  const toggleLockUser = async (userId: string, isLocked?: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isLocked: !isLocked });
      toast.success(`Đã ${!isLocked ? 'khóa' : 'mở khóa'} tài khoản`);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái tài khoản');
      console.error(error);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      toast.success('Đã xóa người dùng thành công');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xóa người dùng');
      console.error(error);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleAddIP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIP.trim()) return;
    try {
      await updateDoc(doc(db, 'settings', 'security'), {
        blockedIPs: arrayUnion(newIP.trim())
      });
      setNewIP('');
      toast.success('Đã thêm IP vào danh sách chặn');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi thêm IP');
      console.error(error);
    }
  };

  const handleRemoveIP = async (ip: string) => {
    try {
      await updateDoc(doc(db, 'settings', 'security'), {
        blockedIPs: arrayRemove(ip)
      });
      toast.success('Đã xóa IP khỏi danh sách chặn');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xóa IP');
      console.error(error);
    }
  };

  const permissionLabels: Record<string, string> = {
    canViewDashboard: 'Xem Dashboard',
    canViewFunds: 'Xem danh sách Quỹ',
    canViewHistory: 'Xem Lịch sử giao dịch',
    canViewReports: 'Xem Thống kê báo cáo',
    canViewSettings: 'Xem Cài đặt ghi chú',
    canAddTransaction: 'Thêm giao dịch mới',
    canEditTransaction: 'Sửa giao dịch',
    canDeleteTransaction: 'Xóa giao dịch',
    canManageAdmins: 'Quản lý Admin/Người dùng',
    canManageIPs: 'Quản lý chặn IP',
    canExportData: 'Xuất dữ liệu (Excel/PDF)',
    canImportData: 'Nhập dữ liệu từ Excel',
    canManageFunds: 'Quản lý Quỹ (Thêm/Sửa/Xóa)',
    canManageNotes: 'Quản lý Ghi chú mẫu',
    canRecalculateBalances: 'Tính tự động lại số dư từ đầu',
  };

  const handleTogglePermission = async (role: 'user' | 'admin', key: string) => {
    if (!isSuperAdmin) return;
    const newPermissions = { ...permissions };
    // @ts-ignore
    newPermissions[role][key] = !newPermissions[role][key];
    try {
      await updatePermissions(newPermissions);
      toast.success('Đã cập nhật quyền hạn');
    } catch (error) {
      toast.error('Lỗi khi cập nhật quyền hạn');
    }
  };

  if (loading) {
    return <div>Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="text-blue-600" />
          Quản lý Admin & Người dùng
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Đăng nhập lần cuối</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSuper = ['sonlyhongduc@gmail.com', 'bmassk3@gmail.com'].includes(user.email);
                
                return (
                  <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <UserIcon size={16} className="text-gray-500" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">{user.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">
                      <div>{user.lastLogin && !isNaN(new Date(user.lastLogin).getTime()) ? format(new Date(user.lastLogin), 'dd/MM/yyyy HH:mm') : 'Chưa rõ'}</div>
                      {user.lastIP && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                          IP: {user.lastIP}
                          {can('canManageIPs') && (
                            <button 
                              onClick={() => {
                                setNewIP(user.lastIP!);
                                toast.info('Đã điền IP vào ô chặn. Vui lòng kéo xuống để xác nhận chặn.');
                              }}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Điền IP này vào danh sách chặn"
                            >
                              <ShieldAlert size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isSuper ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          <ShieldCheck size={14} /> Super Admin
                        </span>
                      ) : user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          <Shield size={14} /> Admin
                        </span>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                            User
                          </span>
                          {user.adminRequested && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Yêu cầu cấp quyền
                            </span>
                          )}
                        </div>
                      )}
                      {user.isLocked && !isSuper && (
                        <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <Lock size={14} /> Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isSuper && user.id !== currentUser?.uid && (
                        <div className="flex items-center justify-end gap-2">
                          {can('canManageAdmins') && (
                            <>
                              <button
                                onClick={() => toggleAdminRole(user.id, user.role)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  user.role === 'admin'
                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40'
                                    : 'text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40'
                                }`}
                              >
                                {user.role === 'admin' ? (
                                  <>
                                    <ShieldAlert size={16} /> Thu hồi Admin
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck size={16} /> {user.adminRequested ? 'Duyệt Admin' : 'Cấp Admin'}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => toggleLockUser(user.id, user.isLocked)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  user.isLocked
                                    ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40'
                                    : 'text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40'
                                }`}
                              >
                                {user.isLocked ? (
                                  <>
                                    <Unlock size={16} /> Mở khóa
                                  </>
                                ) : (
                                  <>
                                    <Lock size={16} /> Khóa
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setUserToDelete({ id: user.id, name: user.displayName || user.email })}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                                title="Xóa người dùng"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Chưa có người dùng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {can('canManageIPs') && (
        <>
          <div className="flex items-center justify-between mt-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="text-red-600" />
              Quản lý IP bị chặn
            </h2>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <form onSubmit={handleAddIP} className="flex gap-3 mb-6">
              <input
                type="text"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="Nhập địa chỉ IP cần chặn (VD: 192.168.1.1)"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={!newIP.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={20} />
                Chặn IP
              </button>
            </form>

            {blockedIPs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {blockedIPs.map((ip) => (
                  <div key={ip} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{ip}</span>
                    <button
                      onClick={() => handleRemoveIP(ip)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Bỏ chặn"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">Chưa có IP nào bị chặn</p>
            )}
          </div>
        </>
      )}

      {isSuperAdmin && (
        <>
          <div className="flex items-center justify-between mt-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-blue-600" />
              Cấu hình quyền hạn vai trò
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Permissions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserIcon size={20} className="text-gray-500" />
                Quyền hạn Người dùng (User)
              </h3>
              <div className="space-y-3">
                {Object.entries(permissions.user).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {permissionLabels[key] || key}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('user', key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Permissions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield size={20} className="text-blue-600" />
                Quyền hạn Quản trị viên (Admin)
              </h3>
              <div className="space-y-3">
                {Object.entries(permissions.admin).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {permissionLabels[key] || key}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('admin', key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!userToDelete}
        onCancel={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Xác nhận xóa người dùng"
        message={`Bạn có chắc chắn muốn xóa người dùng "${userToDelete?.name}" không? Hành động này sẽ xóa dữ liệu hồ sơ của họ khỏi hệ thống.`}
      />
    </div>
  );
};
