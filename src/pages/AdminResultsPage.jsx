import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fetchClient from '../utils/fetchClient';

const AdminResultsPage = () => {
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, completed, disqualified
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/admin-panel/login');
      return;
    }

    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const data = await fetchClient('/results/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      setResults(data.results);
      setStats({
        total: data.totalStudents,
        completed: data.completedStudents,
        disqualified: data.disqualifiedStudents
      });
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://olympiad-server-n02p.onrender.com/api';
      const response = await fetch(`${API_URL}/results/export`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'exam-results.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      alert('Failed to export results: ' + error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin-panel/login');
  };

  const filteredResults = results.filter(result => {
    if (filter === 'completed') return !result.isDisqualified;
    if (filter === 'disqualified') return result.isDisqualified;
    return true;
  });

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>📊 Exam Results</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/admin-panel/dashboard')} className="btn btn-secondary">
            Back to Dashboard
          </button>
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '1400px' }}>
        {/* Statistics */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div className="stat-card">
              <h3>Total Students</h3>
              <p>{stats.total}</p>
            </div>
            <div className="stat-card">
              <h3>Completed</h3>
              <p style={{ color: '#27ae60' }}>{stats.completed}</p>
            </div>
            <div className="stat-card">
              <h3>Disqualified</h3>
              <p style={{ color: '#e74c3c' }}>{stats.disqualified}</p>
            </div>
          </div>
        )}

        {/* Filters and Export */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setFilter('all')} 
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              >
                All ({results.length})
              </button>
              <button 
                onClick={() => setFilter('completed')} 
                className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Completed ({stats?.completed || 0})
              </button>
              <button 
                onClick={() => setFilter('disqualified')} 
                className={`btn ${filter === 'disqualified' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Disqualified ({stats?.disqualified || 0})
              </button>
            </div>
            <button onClick={handleExport} className="btn btn-primary">
              📥 Export to CSV
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="card">
          <h2 style={{ color: '#667eea', marginBottom: '20px' }}>
            Student Results ({filteredResults.length})
          </h2>
          
          {filteredResults.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No results found
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>College</th>
                    <th>Roll No</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Status</th>
                    <th>Time Taken</th>
                    <th>Tab Switches</th>
                    <th>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result) => (
                    <tr key={result.userId} className={result.isDisqualified ? 'disqualified-row' : ''}>
                      <td>
                        {result.rank ? (
                          <strong style={{ fontSize: '18px', color: '#667eea' }}>#{result.rank}</strong>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                      <td><strong>{result.name}</strong></td>
                      <td>{result.collegeName}</td>
                      <td>{result.rollNumber}</td>
                      <td>
                        <strong style={{ fontSize: '16px' }}>
                          {result.score}/{result.totalQuestions}
                        </strong>
                        {result.isDisqualified && (
                          <div style={{ fontSize: '11px', color: '#e74c3c' }}>
                            (Answered: {result.totalAnswered})
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ 
                          fontWeight: 'bold',
                          color: result.percentage >= 80 ? '#27ae60' : result.percentage >= 60 ? '#f39c12' : '#e74c3c'
                        }}>
                          {result.percentage}%
                        </span>
                      </td>
                      <td>
                        {result.isDisqualified ? (
                          <div>
                            <span className="status-badge status-disqualified">
                              ❌ Disqualified
                            </span>
                            <div style={{ fontSize: '11px', marginTop: '5px', color: '#e74c3c' }}>
                              {result.disqualificationReason}
                            </div>
                          </div>
                        ) : (
                          <span className="status-badge status-active">
                            ✅ Completed
                          </span>
                        )}
                      </td>
                      <td>{result.timeTaken}s</td>
                      <td>
                        <span style={{ color: result.tabSwitchCount >= 2 ? '#e74c3c' : '#333' }}>
                          {result.tabSwitchCount}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {new Date(result.submittedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminResultsPage;
