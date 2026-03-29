import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Info, AppWindow, CheckCheck, X } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'regular' | 'app_open';
  createdAt: number;
  isActive: boolean;
}

export const NotificationCenter = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch notifications and filter on client side to avoid composite index requirement
    const q = query(
      collection(db, 'notifications'), 
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeNotifications = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .filter(n => n.isActive && n.type === 'regular');
      
      setNotifications(data);
    });

    // Fetch read status for this user
    const unsubscribeRead = onSnapshot(collection(db, 'users', user.uid, 'readNotifications'), (snapshot) => {
      const ids = new Set(snapshot.docs.map(doc => doc.id));
      setReadIds(ids);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribeNotifications();
      unsubscribeRead();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAsRead = async (id: string) => {
    if (!user || readIds.has(id)) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'readNotifications', id), {
        readAt: Date.now()
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !readIds.has(n.id));
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        title="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-800">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 sm:w-80 md:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden origin-top sm:origin-top-right"
          >
            <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell size={18} className="text-blue-600" />
                Thông báo
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={14} /> Đánh dấu đã đọc tất cả
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {notifications.map((n) => {
                    const isRead = readIds.has(n.id);
                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative ${
                          !isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        {!isRead && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-lg h-fit ${
                            n.type === 'app_open' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {n.type === 'app_open' ? <AppWindow size={16} /> : <Bell size={16} />}
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-sm font-bold mb-1 ${
                              !isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {n.title}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-2">
                              {n.content}
                            </p>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {format(n.createdAt, 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Chưa có thông báo nào</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
