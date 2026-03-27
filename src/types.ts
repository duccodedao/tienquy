export interface Fund {
  id: string;
  name: string;
  balance: number;
  createdAt: number;
  updatedAt: number;
}

export type TransactionType = 'income' | 'expense';

export interface PredefinedNote {
  id: string;
  content: string;
  type: TransactionType | 'both'; // Can be specific to income, expense, or both
  createdAt: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: number;
  note: string;
  fundId: string;
  fundName: string;
  createdAt: number;
  createdBy: string;
  batchId?: string;
}
