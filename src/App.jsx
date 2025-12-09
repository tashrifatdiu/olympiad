import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ExamRulesPage from './pages/ExamRulesPage';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminResultsPage from './pages/AdminResultsPage';
import AdminProtectedRoute from './components/AdminProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <ExamProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/exam-rules" element={<ProtectedRoute><ExamRulesPage /></ProtectedRoute>} />
            <Route path="/exam" element={<ProtectedRoute><ExamPage /></ProtectedRoute>} />
            <Route path="/result" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
            <Route path="/admin-panel/login" element={<AdminLoginPage />} />
            <Route path="/admin-panel/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
            <Route path="/admin-panel/results" element={<AdminProtectedRoute><AdminResultsPage /></AdminProtectedRoute>} />
          </Routes>
        </Router>
      </ExamProvider>
    </AuthProvider>
  );
}

export default App;
