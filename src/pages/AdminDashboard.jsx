import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fetchClient from '../utils/fetchClient';
import io from 'socket.io-client';

const AdminDashboard = () => {
  const [examStatus, setExamStatus] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [settings, setSettings] = useState({
    questionTimeLimit: 7,
    totalQuestions: 5,
    disqualifyOnFullscreenExit: true,
    countdownDuration: 30 // seconds
  });
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [useScheduledStart, setUseScheduledStart] = useState(false);
  const navigate = useNavigate();
  const countdownTimerRef = React.useRef(null);

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    const studentToken = localStorage.getItem('token');
    
    // If student token exists but no admin token, redirect to admin login
    if (!adminToken) {
      if (studentToken) {
        alert('Please login as admin. Student session detected.');
      }
      navigate('/admin-panel/login');
      return;
    }

    // Initialize socket
    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://olympiad-server-n02p.onrender.com';
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.emit('admin-join');

    // Socket listeners
    newSocket.on('student-progress', (data) => {
      fetchLiveStudents();
    });

    newSocket.on('student-disqualified', (data) => {
      fetchLiveStudents();
    });

    newSocket.on('exam-started', () => {
      fetchExamStatus();
    });

    newSocket.on('exam-stopped', () => {
      fetchExamStatus();
      setIsCountdownActive(false);
      setCountdownSeconds(0);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    });

    newSocket.on('exam-countdown-started', (data) => {
      console.log('Countdown started:', data);
      setIsCountdownActive(true);
      // Calculate from start time for accuracy
      if (data.countdownStartTime) {
        const startTime = new Date(data.countdownStartTime);
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, data.countdownSeconds - elapsed);
        setCountdownSeconds(remaining);
        startCountdownTimer(remaining);
      } else {
        setCountdownSeconds(data.countdownSeconds);
        startCountdownTimer(data.countdownSeconds);
      }
    });

    newSocket.on('exam-actually-started', (data) => {
      console.log('Exam actually started');
      setIsCountdownActive(false);
      setCountdownSeconds(0);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      fetchExamStatus();
    });

    fetchExamStatus();
    fetchLiveStudents();

    const interval = setInterval(fetchLiveStudents, 3000);

    return () => {
      newSocket.disconnect();
      clearInterval(interval);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startCountdownTimer = (seconds) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchExamStatus = async () => {
    try {
      const data = await fetchClient('/admin/exam/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      setExamStatus(data);
      setSettings({
        questionTimeLimit: data.questionTimeLimit,
        totalQuestions: data.totalQuestions,
        disqualifyOnFullscreenExit: data.disqualifyOnFullscreenExit,
        countdownDuration: data.countdownDuration || 30
      });
    } catch (error) {
      console.error('Failed to fetch exam status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveStudents = async () => {
    try {
      const data = await fetchClient('/admin/students/live', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      setStudents(data);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const handleStartExam = async () => {
    // Check if exam is already active
    if (examStatus?.isExamActive) {
      alert('⚠️ Exam is already active! Stop the current exam before starting a new one.');
      return;
    }

    if (useScheduledStart) {
      // Scheduled start mode - requires datetime
      if (!scheduledDateTime) {
        alert('⚠️ Please select a date and time for the exam to start.');
        return;
      }

      // Create date object from the datetime-local input (this is in local timezone)
      const scheduledTime = new Date(scheduledDateTime);
      const now = new Date();

      console.log('Selected time:', scheduledDateTime);
      console.log('Scheduled time object:', scheduledTime);
      console.log('Current time:', now);
      console.log('Time difference (ms):', scheduledTime - now);

      if (scheduledTime <= now) {
        alert('⚠️ Scheduled time must be in the future!');
        return;
      }

      const timeDiff = Math.floor((scheduledTime - now) / 1000); // seconds until exam
      const hours = Math.floor(timeDiff / 3600);
      const minutes = Math.floor((timeDiff % 3600) / 60);
      const seconds = timeDiff % 60;

      const confirmMsg = `Schedule exam to start at:\n\n📅 ${scheduledTime.toLocaleDateString()}\n🕐 ${scheduledTime.toLocaleTimeString()}\n\n⏱️ Time until exam: ${hours}h ${minutes}m ${seconds}s\n\n⚠️ This is YOUR LOCAL TIME\n\nAll students will see the same countdown and start at exactly the same time.\n\nProceed?`;

      if (!confirm(confirmMsg)) return;

      try {
        const response = await fetchClient('/admin/exam/schedule', {
          method: 'POST',
          body: JSON.stringify({ scheduledStartTime: scheduledDateTime }),
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
        alert(`✅ Exam scheduled successfully!\n\nExam will start at: ${scheduledTime.toLocaleString()}\n\nAll students will see synchronized countdown.`);
        fetchExamStatus();
      } catch (error) {
        alert('❌ Failed to schedule exam: ' + error.message);
      }
    } else {
      // Immediate start mode - NO datetime required
      const countdownMinutes = Math.floor(settings.countdownDuration / 60);
      const countdownSeconds = settings.countdownDuration % 60;
      const timeDisplay = countdownMinutes > 0 
        ? `${countdownMinutes} minute${countdownMinutes > 1 ? 's' : ''} ${countdownSeconds > 0 ? `${countdownSeconds} seconds` : ''}`
        : `${countdownSeconds} seconds`;
      
      const confirmMsg = `Start exam countdown NOW for all students?\n\nCountdown: ${timeDisplay}\n\nStudents will have ${timeDisplay} to join before the exam begins.\n\nProceed?`;
      
      if (!confirm(confirmMsg)) return;
      
      try {
        const response = await fetchClient('/admin/exam/start', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
        alert(`✅ Exam countdown started!\n\nStudents have ${timeDisplay} to join.\nExam will begin automatically after countdown.`);
        fetchExamStatus();
      } catch (error) {
        alert('❌ Failed to start exam: ' + error.message);
      }
    }
  };

  const handleStopExam = async () => {
    if (!confirm('Stop exam for all students? This will auto-submit all active exams.')) return;
    
    try {
      await fetchClient('/admin/exam/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      alert('Exam stopped successfully!');
      fetchExamStatus();
      setStudents([]);
    } catch (error) {
      alert('Failed to stop exam: ' + error.message);
    }
  };

  const handleDisqualify = async (userId, name) => {
    const reason = prompt(`Disqualify ${name}? Enter reason:`);
    if (!reason) return;

    try {
      await fetchClient('/admin/students/disqualify', {
        method: 'POST',
        body: JSON.stringify({ userId, reason }),
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      alert('Student disqualified');
      fetchLiveStudents();
    } catch (error) {
      alert('Failed to disqualify: ' + error.message);
    }
  };

  const handleClearExamData = async () => {
    if (!window.confirm('⚠️ Clear all exam data?\n\nThis will:\n- Delete all exam sessions\n- Delete all responses\n- Delete all logs\n- Reset exam status\n- Allow students to retake exam\n\nStudent login info will NOT be deleted.\n\nAre you sure?')) {
      return;
    }

    try {
      const data = await fetchClient('/admin/exam/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      alert('✅ ' + data.message);
      fetchExamStatus();
      fetchLiveStudents();
    } catch (error) {
      alert('❌ Failed to clear exam data: ' + error.message);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await fetchClient('/admin/exam/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      alert('Settings updated successfully!');
      fetchExamStatus();
    } catch (error) {
      alert('Failed to update settings: ' + error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    // Don't clear student tokens - they might want to switch back
    navigate('/admin-panel/login');
  };

  if (loading) {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  const handleViewResults = () => {
    navigate('/admin-panel/results');
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🎯 Admin Control Panel</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleViewResults} className="btn btn-primary">
            📊 View Results
          </button>
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '1400px' }}>
        {/* Exam Control */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '20px' }}>Exam Control</h2>
          
          {/* Countdown Display */}
          {isCountdownActive && (
            <div style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: 'white', 
              padding: '30px', 
              borderRadius: '12px', 
              marginBottom: '20px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)'
            }}>
              <h2 style={{ color: 'white', marginBottom: '15px', fontSize: '28px' }}>
                ⏰ Exam Starting In:
              </h2>
              <div style={{ 
                fontSize: '72px', 
                fontWeight: 'bold', 
                fontFamily: 'monospace',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                color: countdownSeconds <= 10 ? '#ffeb3b' : 'white'
              }}>
                {formatTime(countdownSeconds)}
              </div>
              <p style={{ marginTop: '15px', fontSize: '18px', opacity: 0.9 }}>
                Students can join now. Exam will start automatically when countdown ends.
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div className="stat-card">
              <h3>Exam Status</h3>
              <p style={{ color: examStatus?.isExamActive ? '#27ae60' : '#e74c3c' }}>
                {isCountdownActive ? '🟡 COUNTDOWN' : examStatus?.isExamActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
              </p>
            </div>
            <div className="stat-card">
              <h3>Active Students</h3>
              <p>{students.filter(s => !s.isDisqualified).length}</p>
            </div>
            <div className="stat-card">
              <h3>Disqualified</h3>
              <p style={{ color: '#e74c3c' }}>{students.filter(s => s.isDisqualified).length}</p>
            </div>
          </div>

          {/* Scheduled Start Option */}
          <div style={{ background: '#fff3cd', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #ffc107' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={useScheduledStart}
                  onChange={(e) => setUseScheduledStart(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                📅 Schedule Exam Start (Perfect Synchronization)
              </label>
            </div>
            
            {useScheduledStart && (
              <div style={{ background: 'white', padding: '15px', borderRadius: '6px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#333' }}>
                  Select Exam Start Date & Time:
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    fontSize: '16px', 
                    borderRadius: '6px', 
                    border: '2px solid #667eea',
                    fontFamily: 'monospace'
                  }}
                />
                <p style={{ marginTop: '10px', fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                  ✅ <strong>Benefits:</strong><br/>
                  • No alert delays - everyone gets the same countdown<br/>
                  • Perfect synchronization across all students<br/>
                  • Students can join anytime before scheduled start<br/>
                  • Countdown calculated from scheduled time, not button click
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
            <button 
              onClick={handleStartExam} 
              className="btn btn-primary"
              disabled={examStatus?.isExamActive}
              style={{ flex: 1, fontSize: '18px', padding: '15px' }}
            >
              {useScheduledStart ? '📅 Schedule Exam' : '🚀 Start Exam Now'}
            </button>
            <button 
              onClick={handleStopExam} 
              className="btn btn-danger"
              disabled={!examStatus?.isExamActive}
              style={{ flex: 1, fontSize: '18px', padding: '15px' }}
            >
              🛑 Stop Exam for All
            </button>
            <button 
              onClick={handleClearExamData} 
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '18px', padding: '15px', background: '#ff9800', color: 'white' }}
            >
              🗑️ Clear Exam Data
            </button>
          </div>

          {/* Settings */}
          <div style={{ background: '#f8f9ff', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '15px' }}>Exam Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>Total Questions</label>
                <input
                  type="number"
                  value={settings.totalQuestions}
                  onChange={(e) => setSettings({...settings, totalQuestions: parseInt(e.target.value)})}
                  min="1"
                  max="200"
                />
              </div>
              <div className="form-group">
                <label>Question Time Limit (seconds)</label>
                <input
                  type="number"
                  value={settings.questionTimeLimit}
                  onChange={(e) => setSettings({...settings, questionTimeLimit: parseInt(e.target.value)})}
                  min="1"
                  max="60"
                />
              </div>
              <div className="form-group">
                <label>Total Exam Duration</label>
                <input
                  type="text"
                  value={`${settings.totalQuestions * settings.questionTimeLimit} seconds`}
                  disabled
                  style={{ background: '#e0e0e0' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
              <div className="form-group">
                <label>Countdown Before Exam Starts (seconds)</label>
                <input
                  type="number"
                  value={settings.countdownDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 20 && value <= 300) {
                      setSettings({...settings, countdownDuration: value});
                    }
                  }}
                  min="20"
                  max="300"
                  placeholder="20-300 seconds"
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                  Min: 20 seconds, Max: 5 minutes (300 seconds)
                </small>
              </div>
              <div className="form-group">
                <label>Countdown Display</label>
                <input
                  type="text"
                  value={`${Math.floor(settings.countdownDuration / 60)}m ${settings.countdownDuration % 60}s`}
                  disabled
                  style={{ background: '#e0e0e0' }}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={settings.disqualifyOnFullscreenExit}
                  onChange={(e) => setSettings({...settings, disqualifyOnFullscreenExit: e.target.checked})}
                  style={{ width: 'auto', marginRight: '10px' }}
                />
                Auto-disqualify on fullscreen exit
              </label>
            </div>
            <button onClick={handleUpdateSettings} className="btn btn-primary" style={{ marginTop: '15px' }}>
              Save Settings
            </button>
          </div>
        </div>

        {/* Live Students Table */}
        <div className="card">
          <h2 style={{ color: '#667eea', marginBottom: '20px' }}>
            Live Student Monitoring ({students.length} students)
          </h2>
          
          {students.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No students taking exam currently
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>College</th>
                    <th>Roll No</th>
                    <th>Question</th>
                    <th>Answered</th>
                    <th>Tab Switches</th>
                    <th>Status</th>
                    <th>Last Activity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.userId} className={student.isDisqualified ? 'disqualified-row' : ''}>
                      <td><strong>{student.name}</strong></td>
                      <td>{student.collegeName}</td>
                      <td>{student.rollNumber}</td>
                      <td>
                        <span className="question-badge">
                          {student.currentQuestionIndex + 1} / {student.totalQuestions}
                        </span>
                      </td>
                      <td>{student.answeredQuestions}</td>
                      <td>
                        <span style={{ color: student.tabSwitchCount >= 2 ? '#e74c3c' : '#333' }}>
                          {student.tabSwitchCount}
                        </span>
                      </td>
                      <td>
                        {student.isDisqualified ? (
                          <div>
                            <span className="status-badge status-disqualified">
                              ❌ Disqualified
                            </span>
                            <div style={{ fontSize: '11px', marginTop: '5px', color: '#27ae60' }}>
                              Score: {student.finalScore}/{student.totalAnswered}
                            </div>
                          </div>
                        ) : (
                          <span className="status-badge status-active">
                            ✅ Active
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {new Date(student.lastActivity).toLocaleTimeString()}
                      </td>
                      <td>
                        {!student.isDisqualified && (
                          <button
                            onClick={() => handleDisqualify(student.userId, student.name)}
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '12px' }}
                          >
                            Disqualify
                          </button>
                        )}
                        {student.isDisqualified && (
                          <span style={{ fontSize: '11px', color: '#e74c3c' }}>
                            {student.disqualificationReason}
                          </span>
                        )}
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

export default AdminDashboard;
