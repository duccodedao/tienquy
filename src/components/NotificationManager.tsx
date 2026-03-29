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
        // We still want to process the first load for regular notifications 
        // if they are new (since we might have missed them while offline)
        // but for transactions we skip to avoid spamming old history.
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.createdAt > initTimeRef.current) {
            triggerTransactionNotification(data);
          }
        }
      });
    }, (error) => {
      console.error("Error listening for transactions:", error);
    });

    // Listen for new regular notifications
    const nq = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotifications = onSnapshot(nq, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Filter on client side: only active, regular, and new
          if (data.isActive && data.type === 'regular' && data.createdAt > initTimeRef.current) {
            triggerSystemNotification(data);
          }
        }
      });
    });

    return () => {
      unsubscribe();
      unsubscribeNotifications();
    };
  }, [user]);

  const triggerTransactionNotification = (data: any) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const isIncome = data.type === 'income';
    const title = isIncome ? '💰 Nhập quỹ mới' : '💸 Xuất quỹ mới';
    const amountStr = formatCurrency(data.amount);
    const body = `${data.note}\nSố tiền: ${isIncome ? '+' : '-'}${amountStr}\nQuỹ: ${data.fundName}\nNgười tạo: ${data.creatorName || data.createdBy}`;

    showNotification(title, body);
  };

  const triggerSystemNotification = (data: any) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    showNotification(`📢 ${data.title}`, data.content);
  };

  const showNotification = (title: string, body: string) => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body,
            icon: 'https://hdd.io.vn/img/bmassloadings.png',
            tag: `notif-${Date.now()}`
          });
        }).catch(() => {
          new Notification(title, { body, icon: 'https://hdd.io.vn/img/bmassloadings.png' });
        });
      } else {
        new Notification(title, { body, icon: 'https://hdd.io.vn/img/bmassloadings.png' });
      }
    } catch (e) {
      console.error("Error showing notification:", e);
    }
  };

  return null;
};
