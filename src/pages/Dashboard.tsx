import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Fund, Transaction } from '../types';
import { formatCurrency } from '../lib/utils';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { usePermissions } from '../contexts/PermissionsContext';
import { Navigate } from 'react-router-dom';
import { QuickGuide } from '../components/QuickGuide';

export const Dashboard = () => {
  const { can } = usePermissions();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination for recent transactions
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal for batch details
  const [selectedGroup, setSelectedGroup] = useState<Transaction[] | null>(null);

  useEffect(() => {
    const fundsUnsub = onSnapshot(
      collection(db, 'funds'), 
      (snapshot) => {
        const fundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fund));
        setFunds(fundsData);
      },
      (error) => {
        console.error("Error fetching funds:", error);
        setLoading(false);
      }
    );

    const txUnsub = onSnapshot(
      query(collection(db, 'transactions'), orderBy('date', 'desc')), 
      (snapshot) => {
        const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        
        // Client-side secondary sorting to avoid composite index requirement
        const sortedData = txData.sort((a, b) => {
          if (b.date !== a.date) return b.date - a.date;
          if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
          return b.id.localeCompare(a.id);
        });
        
        setTransactions(sortedData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching transactions:", error);
        setLoading(false);
      }
    );

    return () => {
      fundsUnsub();
      txUnsub();
    };
  }, []);

  const totalBalance = funds.reduce((sum, fund) => sum + fund.balance, 0);
  
  const now = new Date();

  // Calculate today's income and expense
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayTx = transactions.filter(tx => tx.date >= startOfToday);
  const todayIncome = todayTx.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const todayExpense = todayTx.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const todayProfit = todayIncome - todayExpense;

  // Calculate last 30 days income and expense
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
  const last30DaysTx = transactions.filter(tx => tx.date >= thirtyDaysAgo);
  const last30DaysIncome = last30DaysTx.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const last30DaysExpense = last30DaysTx.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const last30DaysProfit = last30DaysIncome - last30DaysExpense;

  // Prepare chart data (last 15 days)
  const dailyData = [];
  for (let i = 14; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStart = d.getTime();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999).getTime();
    
    const dayTx = transactions.filter(tx => tx.date >= dayStart && tx.date <= dayEnd);
    const income = dayTx.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const expense = dayTx.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    
    dailyData.push({
      name: format(d, 'dd/MM'),
      'Thu': income,
      'Chi': expense
    });
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Group transactions by batchId
  const groupedTransactions = React.useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(tx => {
      const key = tx.batchId || tx.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.values(groups).sort((a, b) => b[0].date - a[0].date);
  }, [transactions]);

  // Pagination logic
  const totalPages = Math.ceil(groupedTransactions.length / itemsPerPage);
  const paginatedGroups = groupedTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return <div className="animate-pulse flex space-x-4">
      <div className="flex-1 space-y-6 py-1">
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl col-span-2"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl col-span-1"></div>
          </div>
        </div>
      </div>
    </div>;
  }

  if (!can('canViewDashboard')) return <Navigate to="/history" replace />;

  const safeFormat = (date: number | string | Date, formatStr: string) => {
    if (!date || isNaN(new Date(date).getTime())) return 'N/A';
    return format(new Date(date), formatStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tổng quan</h1>
      </div>
      
      <QuickGuide />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số dư hiện tại</p>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mt-2">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-blue-600 dark:text-blue-400">
              <Wallet size={32} />
            </div>
          </div>
        </div>

        {/* Today Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Hôm nay</p>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Thu:</span>
              <span className="font-semibold text-green-600">+{formatCurrency(todayIncome)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Chi:</span>
              <span className="font-semibold text-red-600">-{formatCurrency(todayExpense)}</span>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lợi nhuận:</span>
              <span className={`font-bold ${todayProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {todayProfit > 0 ? '+' : ''}{formatCurrency(todayProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* 30 Days Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">30 ngày gần nhất</p>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Thu:</span>
              <span className="font-semibold text-green-600">+{formatCurrency(last30DaysIncome)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Chi:</span>
              <span className="font-semibold text-red-600">-{formatCurrency(last30DaysExpense)}</span>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lợi nhuận:</span>
              <span className={`font-bold ${last30DaysProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {last30DaysProfit > 0 ? '+' : ''}{formatCurrency(last30DaysProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thu / Chi 15 ngày gần nhất</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" stroke="#6B7280" />
                <YAxis stroke="#6B7280" tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                />
                <Legend />
                <Bar dataKey="Thu" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chi" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tỷ trọng các quỹ</h2>
          <div className="h-80">
            {funds.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funds}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="balance"
                    nameKey="name"
                  >
                    {funds.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">Chưa có dữ liệu quỹ</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Giao dịch gần đây (Theo lô)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3 rounded-tl-lg">Ngày giờ</th>
                <th className="px-6 py-3">Loại</th>
                <th className="px-6 py-3">Tổng tiền</th>
                <th className="px-6 py-3">Số dư cuối</th>
                <th className="px-6 py-3">Số lượng</th>
                <th className="px-6 py-3">Ghi chú</th>
                <th className="px-6 py-3 rounded-tr-lg text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.map((group) => {
                const firstTx = group[0];
                const totalIncome = group.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
                const totalExpense = group.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
                const isMixed = totalIncome > 0 && totalExpense > 0;
                const typeLabel = isMixed ? 'Hỗn hợp' : (totalIncome > 0 ? 'Thu' : 'Chi');
                const netAmount = totalIncome - totalExpense;
                
                const combinedNotes = Array.from(new Set(group.map(tx => tx.note).filter(Boolean))).join(', ');
                const incomeCount = group.filter(tx => tx.type === 'income').length;
                const expenseCount = group.filter(tx => tx.type === 'expense').length;

                return (
                  <tr key={firstTx.batchId || firstTx.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">{safeFormat(firstTx.date, 'dd/MM/yyyy HH:mm')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        isMixed ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        totalIncome > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium whitespace-nowrap">
                      {isMixed ? (
                        <div className="flex flex-col text-xs">
                          <span className="text-green-600 dark:text-green-400">+{formatCurrency(totalIncome)}</span>
                          <span className="text-red-600 dark:text-red-400">-{formatCurrency(totalExpense)}</span>
                        </div>
                      ) : (
                        <span className={totalIncome > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {totalIncome > 0 ? '+' : '-'}{formatCurrency(Math.abs(netAmount))}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {(() => {
                        const uniqueFunds = new Set(group.map(tx => tx.fundId));
                        if (uniqueFunds.size === 1) {
                          return group[0].balanceAfter !== undefined ? formatCurrency(group[0].balanceAfter) : '-';
                        }
                        return <span className="text-xs text-gray-400 italic">Nhiều quỹ</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {incomeCount > 0 && <span className="text-green-600">{incomeCount} Thu </span>}
                      {expenseCount > 0 && <span className="text-red-600">{expenseCount} Chi</span>}
                    </td>
                    <td className="px-6 py-4 truncate max-w-xs" title={combinedNotes}>{combinedNotes || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedGroup(group)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-flex items-center"
                        title="Xem chi tiết"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {groupedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Chưa có giao dịch nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} đến {Math.min(currentPage * itemsPerPage, groupedTransactions.length)} trong số {groupedTransactions.length} lô giao dịch
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Batch Details Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Chi tiết lô giao dịch ({safeFormat(selectedGroup[0].date, 'dd/MM/yyyy HH:mm')})
              </h2>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Số tiền</th>
                      <th className="px-4 py-3">Số dư cuối</th>
                      <th className="px-4 py-3">Quỹ</th>
                      <th className="px-4 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.map((tx) => (
                      <tr key={tx.id} className="border-b dark:border-gray-700">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tx.type === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {tx.type === 'income' ? 'Thu' : 'Chi'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {tx.balanceAfter !== undefined ? formatCurrency(tx.balanceAfter) : '-'}
                        </td>
                        <td className="px-4 py-3">{tx.fundName}</td>
                        <td className="px-4 py-3">{tx.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
