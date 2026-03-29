import React, { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';

export const NotificationManager: React.FC = () => {
  const { user } = useAuth();
  const initTimeRef = useRef(Date.now());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!user) return;

    // Listen for new transactions
    const q = query(
      collection(db, 'transactions'),
      where('createdAt', '>=', initTimeRef.current),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          // Only notify if it's a new transaction (created after we started listening)
          if (data.createdAt > initTimeRef.current) {
            triggerNotification(data);
          }
        }
      });
    }, (error) => {
      console.error("Error listening for notifications:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const triggerNotification = (data: any) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const isIncome = data.type === 'income';
    const title = isIncome ? '💰 Nhập quỹ mới' : '💸 Xuất quỹ mới';
    const amountStr = formatCurrency(data.amount);
    const body = `${data.note}\nSố tiền: ${isIncome ? '+' : '-'}${amountStr}\nQuỹ: ${data.fundName}\nNgười tạo: ${data.createdBy}`;

    try {
      // Try to use Service Worker registration for mobile support
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body,
            icon: 'https://hdd.io.vn/img/bmassloadings.png',
            tag: `tx-${data.createdAt}`
          });
        }).catch(() => {
          // Fallback to standard notification
          new Notification(title, { 
            body,
            icon: 'https://hdd.io.vn/img/bmassloadings.png'
          });
        });
      } else {
        new Notification(title, { 
          body,
          icon: 'https://hdd.io.vn/img/bmassloadings.png'
        });
      }
    } catch (e) {
      console.error("Error showing notification:", e);
    }
  };

  return null;
};
