import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Fund, TransactionType } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { Search, Filter, Download, Upload, Trash2, Edit2, ChevronLeft, ChevronRight, X, Check, Eye, Copy, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

export const History = () => {
  const { user, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterFund, setFilterFund] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Transaction>>({});

  // Batch Details Modal
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [confirmEditTx, setConfirmEditTx] = useState<Transaction | null>(null);

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
        toast.error("Không thể tải dữ liệu giao dịch. Vui lòng kiểm tra kết nối hoặc quyền truy cập.");
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
      }
    );

    return () => {
      unsubTx();
      unsubFunds();
    };
  }, []);

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const note = tx.note || '';
      const fundName = tx.fundName || '';
      const searchLower = (searchTerm || '').toLowerCase();
      
      const matchesSearch = note.toLowerCase().includes(searchLower) || 
                            fundName.toLowerCase().includes(searchLower);
      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesFund = filterFund === 'all' || tx.fundId === filterFund;
      
      let matchesDate = true;
      if (dateRange.start) {
        matchesDate = matchesDate && tx.date >= new Date(dateRange.start).getTime();
      }
      if (dateRange.end) {
        // Set end date to end of day
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && tx.date <= endDate.getTime();
      }

      return matchesSearch && matchesType && matchesFund && matchesDate;
    });
  }, [transactions, searchTerm, filterType, filterFund, dateRange]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const batchTransactions = useMemo(() => {
    if (!selectedBatchId) return [];
    return transactions.filter(tx => tx.batchId === selectedBatchId);
  }, [transactions, selectedBatchId]);

  const confirmDelete = async () => {
    if (!isAdmin || !deleteTx) return;
    try {
      const batch = writeBatch(db);
      
      // Delete transaction
      batch.delete(doc(db, 'transactions', deleteTx.id));
      
      // Revert fund balance
      const fundRef = doc(db, 'funds', deleteTx.fundId);
      const balanceChange = deleteTx.type === 'income' ? -deleteTx.amount : deleteTx.amount;
      batch.set(fundRef, {
        balance: increment(balanceChange),
        updatedAt: Date.now()
      }, { merge: true });

      await batch.commit();
      toast.success('Đã xóa giao dịch và hoàn lại số dư');
    } catch (error) {
      toast.error('Lỗi khi xóa giao dịch');
    } finally {
      setDeleteTx(null);
    }
  };

  const handleEdit = (tx: Transaction) => {
    if (!isAdmin) return;
    setEditingId(tx.id);
    setEditData({
      note: tx.note,
      amount: tx.amount,
      type: tx.type,
      fundId: tx.fundId
    });
  };

  const handleSaveEditClick = (tx: Transaction) => {
    if (!isAdmin) return;
    if (!editData.note || !editData.amount || !editData.fundId) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setConfirmEditTx(tx);
  };

  const executeSaveEdit = async () => {
    if (!isAdmin || !confirmEditTx) return;

    try {
      const batch = writeBatch(db);
      const newAmount = Number(editData.amount);
      const newFund = funds.find(f => f.id === editData.fundId);

      // If fund or amount or type changed, we need to adjust balances
      if (
        confirmEditTx.amount !== newAmount || 
        confirmEditTx.fundId !== editData.fundId || 
        confirmEditTx.type !== editData.type
      ) {
        if (confirmEditTx.fundId === editData.fundId) {
          // Same fund, combine the changes into a single increment
          const revertChange = confirmEditTx.type === 'income' ? -confirmEditTx.amount : confirmEditTx.amount;
          const applyChange = editData.type === 'income' ? newAmount : -newAmount;
          const netChange = revertChange + applyChange;
          
          if (netChange !== 0) {
            const fundRef = doc(db, 'funds', confirmEditTx.fundId);
            batch.set(fundRef, { balance: increment(netChange) }, { merge: true });
          }
        } else {
          // Different funds, update separately
          // 1. Revert original transaction effect on original fund
          const origFundRef = doc(db, 'funds', confirmEditTx.fundId);
          const revertChange = confirmEditTx.type === 'income' ? -confirmEditTx.amount : confirmEditTx.amount;
          batch.set(origFundRef, { balance: increment(revertChange) }, { merge: true });

          // 2. Apply new transaction effect on new fund
          const newFundRef = doc(db, 'funds', editData.fundId!);
          const applyChange = editData.type === 'income' ? newAmount : -newAmount;
          batch.set(newFundRef, { balance: increment(applyChange) }, { merge: true });
        }
      }

      // Update transaction document
      const txRef = doc(db, 'transactions', confirmEditTx.id);
      batch.update(txRef, {
        note: editData.note,
        amount: newAmount,
        type: editData.type,
        fundId: editData.fundId,
        fundName: newFund?.name || confirmEditTx.fundName
      });

      await batch.commit();
      setEditingId(null);
      toast.success('Cập nhật giao dịch thành công');
    } catch (error) {
      toast.error('Lỗi khi cập nhật giao dịch');
    } finally {
      setConfirmEditTx(null);
    }
  };

  const safeFormat = (date: number | string | Date, formatStr: string) => {
    if (!date || isNaN(new Date(date).getTime())) return 'N/A';
    return format(new Date(date), formatStr);
  };

  const exportToExcel = () => {
    const dataToExport = filteredTransactions.map(tx => ({
      'Ngày giờ': safeFormat(tx.date, 'dd/MM/yyyy HH:mm'),
      'Loại': tx.type === 'income' ? 'Thu' : 'Chi',
      'Số tiền': tx.amount,
      'Quỹ': tx.fundName,
      'Ghi chú': tx.note,
      'Người tạo': tx.createdBy
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Giao dịch");
    XLSX.writeFile(wb, `Lich_su_giao_dich_${safeFormat(new Date(), 'ddMMyyyy')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.text('Lịch sử giao dịch', 14, 15);
    
    const tableColumn = ["Ngày giờ", "Loại", "Số tiền", "Quỹ", "Ghi chú"];
    const tableRows = filteredTransactions.map(tx => [
      safeFormat(tx.date, 'dd/MM/yyyy HH:mm'),
      tx.type === 'income' ? 'Thu' : 'Chi',
      new Intl.NumberFormat('vi-VN').format(tx.amount),
      tx.fundName,
      tx.note
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { font: 'helvetica' },
    });

    doc.save(`Lich_su_giao_dich_${safeFormat(new Date(), 'ddMMyyyy')}.pdf`);
  };

  const copyAsText = () => {
    if (filteredTransactions.length === 0) {
      toast.error('Không có dữ liệu để copy');
      return;
    }

    let text = 'BÁO CÁO GIAO DỊCH\n';
    text += `Ngày xuất: ${safeFormat(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
    text += '----------------------------------------\n\n';

    let totalIncome = 0;
    let totalExpense = 0;

    filteredTransactions.forEach((tx, index) => {
      const dateStr = safeFormat(tx.date, 'dd/MM/yyyy HH:mm');
      const typeStr = tx.type === 'income' ? 'Thu' : 'Chi';
      const amountStr = formatCurrency(tx.amount);
      
      text += `${index + 1}. [${dateStr}] ${typeStr} - ${amountStr}\n`;
      text += `   Quỹ: ${tx.fundName}\n`;
      text += `   Ghi chú: ${tx.note}\n\n`;

      if (tx.type === 'income') totalIncome += tx.amount;
      else totalExpense += tx.amount;
    });

    text += '----------------------------------------\n';
    text += `Tổng thu: ${formatCurrency(totalIncome)}\n`;
    text += `Tổng chi: ${formatCurrency(totalExpense)}\n`;
    text += `Chênh lệch: ${formatCurrency(totalIncome - totalExpense)}\n`;
    
    const totalBalance = funds.reduce((s, f) => s + f.balance, 0);
    text += `Tổng số dư hiện tại: ${formatCurrency(totalBalance)}\n`;

    navigator.clipboard.writeText(text).then(() => {
      toast.success('Đã copy báo cáo dạng chữ, bạn có thể dán vào Zalo');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast.error('Lỗi khi copy báo cáo');
    });
  };

  const exportAsImage = async () => {
    if (!tableRef.current) return;
    
    try {
      toast.info('Đang tạo ảnh báo cáo...');
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Bao_Cao_Giao_Dich_${safeFormat(new Date(), 'dd_MM_yyyy_HH_mm')}.png`;
      link.click();
      
      toast.success('Đã xuất ảnh báo cáo thành công');
    } catch (error) {
      console.error('Error exporting image:', error);
      toast.error('Lỗi khi xuất ảnh báo cáo');
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error('File Excel trống');
          return;
        }

        // Validate data
        const validRows = [];
        for (const row of data) {
          if (!row['Ngày'] || !row['Loại'] || !row['Số tiền'] || !row['Quỹ'] || !row['Ghi chú']) {
            toast.error('File Excel thiếu cột bắt buộc (Ngày, Loại, Số tiền, Quỹ, Ghi chú)');
            return;
          }
          
          const type = row['Loại'].toLowerCase() === 'thu' ? 'income' : row['Loại'].toLowerCase() === 'chi' ? 'expense' : null;
          if (!type) {
            toast.error(`Loại giao dịch không hợp lệ: ${row['Loại']}. Chỉ chấp nhận "Thu" hoặc "Chi"`);
            return;
          }

          const fund = funds.find(f => f.name.toLowerCase() === row['Quỹ'].toLowerCase());
          if (!fund) {
            toast.error(`Không tìm thấy quỹ: ${row['Quỹ']}. Vui lòng tạo quỹ trước.`);
            return;
          }

          // Parse date (assuming DD/MM/YYYY or similar Excel format)
          let dateNum = Date.now();
          if (typeof row['Ngày'] === 'number') {
            // Excel date format
            dateNum = new Date((row['Ngày'] - (25567 + 2)) * 86400 * 1000).getTime();
          } else if (typeof row['Ngày'] === 'string') {
            const parts = row['Ngày'].split('/');
            if (parts.length === 3) {
              dateNum = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
            }
          }

          validRows.push({
            type,
            amount: Number(row['Số tiền']),
            date: dateNum,
            note: String(row['Ghi chú']),
            fundId: fund.id,
            fundName: fund.name
          });
        }

        // Batch insert
        const batch = writeBatch(db);
        validRows.forEach(row => {
          const txRef = doc(collection(db, 'transactions'));
          batch.set(txRef, {
            ...row,
            createdAt: Date.now(),
            createdBy: user?.email || 'Unknown'
          });

          const fundRef = doc(db, 'funds', row.fundId);
          const balanceChange = row.type === 'income' ? row.amount : -row.amount;
          batch.update(fundRef, {
            balance: increment(balanceChange),
            updatedAt: Date.now()
          });
        });

        await batch.commit();
        toast.success(`Đã import thành công ${validRows.length} giao dịch`);
      } catch (error) {
        console.error(error);
        toast.error('Lỗi khi đọc file Excel');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Ngày': '27/03/2026',
        'Loại': 'Thu',
        'Số tiền': 1000000,
        'Quỹ': funds[0]?.name || 'Tiền mặt',
        'Ghi chú': 'Thu tiền bán hàng'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Giao_Dich.xlsx");
  };

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lịch sử giao dịch</h1>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button onClick={downloadTemplate} className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm shadow-sm">
                Tải File Mẫu
              </button>
              <label className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm cursor-pointer">
                <Upload size={16} className="mr-2" />
                Import Excel
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImportExcel}
                />
              </label>
            </>
          )}
          <button onClick={exportToExcel} className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm shadow-sm">
            <Download size={16} className="mr-2" />
            Excel
          </button>
          <button onClick={exportToPDF} className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm shadow-sm">
            <Download size={16} className="mr-2" />
            PDF
          </button>
          <button onClick={copyAsText} className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm shadow-sm">
            <Copy size={16} className="mr-2" />
            Copy Text
          </button>
          <button onClick={exportAsImage} className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm shadow-sm">
            <ImageIcon size={16} className="mr-2" />
            Xuất Ảnh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">Tất cả loại</option>
          <option value="income">Thu</option>
          <option value="expense">Chi</option>
        </select>

        <select
          value={filterFund}
          onChange={(e) => setFilterFund(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">Tất cả quỹ</option>
          {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          title="Từ ngày"
        />
        
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          title="Đến ngày"
        />
      </div>

      {/* Table */}
      <div ref={tableRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Ngày giờ</th>
                <th className="px-6 py-4">Loại</th>
                <th className="px-6 py-4">Số tiền</th>
                <th className="px-6 py-4">Quỹ</th>
                <th className="px-6 py-4">Ghi chú</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((tx) => (
                <tr key={tx.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {editingId === tx.id ? (
                    // Edit Mode
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">{safeFormat(tx.date, 'dd/MM/yyyy HH:mm')}</td>
                      <td className="px-6 py-4">
                        <select 
                          value={editData.type}
                          onChange={(e) => setEditData({...editData, type: e.target.value as TransactionType})}
                          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="income">Thu</option>
                          <option value="expense">Chi</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={editData.amount}
                          onChange={(e) => setEditData({...editData, amount: Number(e.target.value)})}
                          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={editData.fundId}
                          onChange={(e) => setEditData({...editData, fundId: e.target.value})}
                          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={editData.note}
                          onChange={(e) => setEditData({...editData, note: e.target.value})}
                          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleSaveEditClick(tx)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                            <Check size={18} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">{safeFormat(tx.date, 'dd/MM/yyyy HH:mm')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          tx.type === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {tx.type === 'income' ? 'Thu' : 'Chi'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-medium whitespace-nowrap ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{tx.fundName}</td>
                      <td className="px-6 py-4 max-w-xs truncate" title={tx.note}>
                        {tx.note}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {tx.batchId && (
                            <button 
                              onClick={() => setSelectedBatchId(tx.batchId!)} 
                              className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" 
                              title="Xem chi tiết lô"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => handleEdit(tx)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Sửa">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => setDeleteTx(tx)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xóa">
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {paginatedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy giao dịch nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} đến {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} trong số {filteredTransactions.length} giao dịch
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
      {selectedBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chi tiết lô giao dịch</h2>
              <button 
                onClick={() => setSelectedBatchId(null)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tổng số giao dịch: <span className="font-bold text-gray-900 dark:text-white">{batchTransactions.length}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tổng tiền: <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(batchTransactions.reduce((sum, tx) => sum + tx.amount, 0))}
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Ngày giờ</th>
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Số tiền</th>
                      <th className="px-4 py-3">Quỹ</th>
                      <th className="px-4 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 whitespace-nowrap">{safeFormat(tx.date, 'dd/MM/yyyy HH:mm')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            tx.type === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {tx.type === 'income' ? 'Thu' : 'Chi'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium whitespace-nowrap ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{tx.fundName}</td>
                        <td className="px-4 py-3">{tx.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setSelectedBatchId(null)}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTx}
        title="Xác nhận xóa giao dịch"
        message="Bạn có chắc chắn muốn xóa giao dịch này? Số dư quỹ sẽ được hoàn lại."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTx(null)}
      />

      <ConfirmModal
        isOpen={!!confirmEditTx}
        title="Xác nhận cập nhật giao dịch"
        message="Bạn có chắc chắn muốn cập nhật giao dịch này không? Số dư quỹ sẽ được điều chỉnh tương ứng."
        onConfirm={executeSaveEdit}
        onCancel={() => setConfirmEditTx(null)}
      />
    </div>
  );
};
