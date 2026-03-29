import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Fund } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { usePermissions } from '../contexts/PermissionsContext';
import { Navigate } from 'react-router-dom';

export const Reports = () => {
  const { can } = usePermissions();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), orderBy('date', 'desc')), 
      (snapshot) => {
        const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(txData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching transactions:", error);
        setLoading(false);
      }
    );

    const unsubFunds = onSnapshot(
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

    return () => {
      unsubTx();
      unsubFunds();
    };
  }, []);

  const filteredTx = useMemo(() => {
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);
    return transactions.filter(tx => tx.date >= start && tx.date <= end.getTime());
  }, [transactions, dateRange]);

  // Data for Income vs Expense Bar Chart (Daily)
  const dailyData = useMemo(() => {
    const dataMap = new Map();
    
    filteredTx.forEach(tx => {
      if (!tx.date || isNaN(new Date(tx.date).getTime())) return;
      const dayStr = format(new Date(tx.date), 'dd/MM');
      if (!dataMap.has(dayStr)) {
        dataMap.set(dayStr, { name: dayStr, Thu: 0, Chi: 0, timestamp: new Date(tx.date).setHours(0,0,0,0) });
      }
      const current = dataMap.get(dayStr);
      if (tx.type === 'income') current.Thu += tx.amount;
      else current.Chi += tx.amount;
    });

    // Sort by date
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredTx]);

  // Data for Cash Flow Line Chart
  const cashFlowData = useMemo(() => {
    let cumulative = 0;
    // Sort ascending for cumulative calculation
    const sortedTx = [...filteredTx].filter(tx => tx.date && !isNaN(new Date(tx.date).getTime())).sort((a, b) => a.date - b.date);
    
    return sortedTx.map(tx => {
      cumulative += tx.type === 'income' ? tx.amount : -tx.amount;
      return {
        date: format(new Date(tx.date), 'dd/MM'),
        'Số dư': cumulative
      };
    });
  }, [filteredTx]);

  // Data for Fund Distribution
  const fundDistribution = useMemo(() => {
    return funds.map(f => ({ name: f.name, value: f.balance })).filter(f => f.value > 0);
  }, [funds]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  const totalIncome = filteredTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = filteredTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const totalBalance = funds.reduce((s, f) => s + f.balance, 0);

  if (loading) return <div>Đang tải...</div>;
  if (!can('canViewReports')) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thống kê & Báo cáo</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tổng số dư hiện tại: <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalBalance)}</span></p>
        </div>
        
        <div className="flex gap-2 items-center bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500">Từ:</span>
          <input 
            type="date" 
            value={dateRange.start}
            onChange={e => setDateRange(p => ({...p, start: e.target.value}))}
            className="text-sm border-none bg-transparent outline-none dark:text-white"
          />
          <span className="text-sm text-gray-500">Đến:</span>
          <input 
            type="date" 
            value={dateRange.end}
            onChange={e => setDateRange(p => ({...p, end: e.target.value}))}
            className="text-sm border-none bg-transparent outline-none dark:text-white"
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng thu</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng chi</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Chênh lệch (Thu - Chi)</p>
          <p className={`text-2xl font-bold mt-2 ${totalIncome - totalExpense >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Thu vs Chi theo ngày</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" stroke="#6B7280" />
                <YAxis stroke="#6B7280" tickFormatter={(v) => new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(v)} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
                <Legend />
                <Bar dataKey="Thu" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chi" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fund Distribution Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Tỷ trọng các quỹ</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fundDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {fundDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash Flow Line Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Xu hướng dòng tiền</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="date" stroke="#6B7280" minTickGap={30} />
                <YAxis stroke="#6B7280" tickFormatter={(v) => new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(v)} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
                <Line type="monotone" dataKey="Số dư" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
