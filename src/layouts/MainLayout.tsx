import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  History, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Monitor,
  Users
} from 'lucide-react';
import { Toaster } from 'sonner';

const navItems = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} />, adminOnly: false },
  { path: '/funds', label: 'Quản lý quỹ', icon: <Wallet size={20} />, adminOnly: false },
  { path: '/income', label: 'Nhập quỹ (Thu)', icon: <ArrowDownCircle size={20} />, adminOnly: true },
  { path: '/expense', label: 'Xuất quỹ (Chi)', icon: <ArrowUpCircle size={20} />, adminOnly: true },
  { path: '/history', label: 'Lịch sử', icon: <History size={20} />, adminOnly: false },
  { path: '/reports', label: 'Thống kê', icon: <BarChart3 size={20} />, adminOnly: false },
  { path: '/settings', label: 'Ghi chú mẫu', icon: <Settings size={20} />, adminOnly: false },
  { path: '/admins', label: 'Quản lý Admin', icon: <Users size={20} />, superAdminOnly: true },
];

export const MainLayout = () => {
  const { user, isAdmin, isSuperAdmin, logout, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">Đang tải...</div>;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FundManager</span>
          <button onClick={toggleSidebar} className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {navItems.filter(item => {
            if (item.superAdminOnly) return isSuperAdmin;
            if (item.adminOnly) return isAdmin;
            return true;
          }).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
                }`
              }
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
          <button 
            onClick={toggleSidebar} 
            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg lg:hidden"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center space-x-4 ml-auto">
            {/* Theme Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-1">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-white text-yellow-500 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Light Mode"
              >
                <Sun size={16} />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-full transition-colors ${theme === 'system' ? 'bg-white dark:bg-gray-600 text-blue-500 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="System Mode"
              >
                <Monitor size={16} />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-gray-600 text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                title="Dark Mode"
              >
                <Moon size={16} />
              </button>
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center space-x-3 border-l border-gray-200 dark:border-gray-700 pl-4">
              {user ? (
                <>
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-medium">{user.displayName || user.email?.split('@')[0]}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
                  </div>
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}`} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600"
                  />
                  <button 
                    onClick={() => setConfirmLogout(true)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors"
                    title="Đăng xuất"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Đăng nhập
                </NavLink>
              )}
            </div>
          </div>
        </header>

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" richColors />

      <ConfirmModal
        isOpen={confirmLogout}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};
