import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Wallet, ArrowDownCircle, ArrowUpCircle, History, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const QuickGuide = () => {
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    {
      icon: <Wallet className="text-blue-500" size={20} />,
      title: '1. Thiết lập Quỹ',
      description: 'Vào mục "Quản lý quỹ" để tạo các nguồn tiền của bạn (ví dụ: Tiền mặt, Tài khoản ngân hàng, Quỹ Công đoàn...).'
    },
    {
      icon: <ArrowDownCircle className="text-green-500" size={20} />,
      title: '2. Nhập/Xuất giao dịch',
      description: 'Sử dụng "Nhập quỹ" (Thu) hoặc "Xuất quỹ" (Chi). Bạn có thể nhập nhiều dòng cùng lúc để tiết kiệm thời gian.'
    },
    {
      icon: <History className="text-purple-500" size={20} />,
      title: '3. Xem Lịch sử & Báo cáo',
      description: 'Tab "Lịch sử" cho phép bạn lọc, tìm kiếm và xuất dữ liệu ra Excel, PDF hoặc copy văn bản để gửi qua Zalo.'
    },
    {
      icon: <RefreshCw className="text-amber-500" size={20} />,
      title: '4. Chuẩn hóa số dư',
      description: 'Nếu số dư bị lệch do chỉnh sửa dữ liệu cũ, hãy nhấn "Tính tự động từ đầu" trong tab Lịch sử để hệ thống tự cân đối lại.'
    },
    {
      icon: <Shield className="text-red-500" size={20} />,
      title: '5. Phân quyền Admin',
      description: 'Super Admin có thể cấp quyền cho người khác và giới hạn những gì họ được phép xem hoặc chỉnh sửa.'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 overflow-hidden mb-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
            <HelpCircle size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-900 dark:text-white">Hướng dẫn nhanh cho người mới</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Xem 5 bước cơ bản để làm chủ hệ thống</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-4 pt-0 border-t border-gray-50 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {steps.map((step, index) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center gap-3 mb-2">
                      {step.icon}
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{step.title}</h4>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs text-blue-700 dark:text-blue-300 text-center italic">
                  💡 Mẹo: Bạn có thể cài đặt ứng dụng này lên màn hình điện thoại (PWA) để sử dụng như một App thực thụ!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
