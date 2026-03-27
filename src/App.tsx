/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Funds } from './pages/Funds';
import { Income, Expense } from './pages/TransactionForm';
import { History } from './pages/History';
import { Reports } from './pages/Reports';
import { PredefinedNotes } from './pages/PredefinedNotes';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="fundmanager-theme">
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="funds" element={<Funds />} />
              <Route path="income" element={<Income />} />
              <Route path="expense" element={<Expense />} />
              <Route path="history" element={<History />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<PredefinedNotes />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
