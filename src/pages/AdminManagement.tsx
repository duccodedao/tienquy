import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  role?: string;
  lastLogin?: number;
}

export const AdminManagement = () => {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  if (authLoading) return <div>Đang tải...</div>;
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const toggleAdminRole = async (userId: string, currentRole?: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateDoc(userRef, { role: newRole });
      toast.success(`Đã ${newRole === 'admin' ? 'cấp' : 'thu hồi'} quyền Admin`);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi cập nhật quyền');
      console.error(error);
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
          Quản lý Admin
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
                      {user.lastLogin && !isNaN(new Date(user.lastLogin).getTime()) ? format(new Date(user.lastLogin), 'dd/MM/yyyy HH:mm') : 'Chưa rõ'}
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isSuper && (
                        <button
                          onClick={() => toggleAdminRole(user.id, user.role)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            user.role === 'admin'
                              ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40'
                              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <>
                              <ShieldAlert size={16} /> Thu hồi Admin
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={16} /> Cấp Admin
                            </>
                          )}
                        </button>
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
    </div>
  );
};
