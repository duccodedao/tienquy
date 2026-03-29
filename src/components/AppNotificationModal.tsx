import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { AppWindow, X, Bell, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'app_open';
  createdAt: number;
}

export const AppNotificationModal = () => {
  const { user } = useAuth();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fetch notifications and filter on client side to avoid composite index requirement
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const activeAppOpenNotif = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .find(n => n.isActive && n.type === 'app_open');
      
      if (activeAppOpenNotif) {
        const data = activeAppOpenNotif as Notification;
        
        // Check if user has already read this specific notification
        const readDoc = await getDoc(doc(db, 'users', user.uid, 'readNotifications', data.id));
        
        if (!readDoc.exists()) {
          setNotification(data);
          setIsOpen(true);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleClose = async () => {
    if (user && notification) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'readNotifications', notification.id), {
          readAt: Date.now()
        });
      } catch (error) {
        console.error("Error marking app_open notification as read:", error);
      }
    }
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && notification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-amber-100 dark:border-amber-900/30"
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AppWindow size={24} />
                </div>
                <h2 className="text-xl font-bold">Thông báo quan trọng</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-12 bg-amber-500 rounded-full" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                  {notification.title}
                </h3>
              </div>
              
              <div className="bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100/50 dark:border-amber-900/20 mb-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {notification.content}
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleClose}
                  className="px-10 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 transition-all hover:scale-105 active:scale-95"
                >
                  Tôi đã hiểu
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex justify-center border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Info size={14} />
                <span>Thông báo này sẽ không hiện lại sau khi bạn đóng.</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
