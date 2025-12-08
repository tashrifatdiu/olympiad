import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import fetchClient from '../utils/fetchClient';
import io from 'socket.io-client';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [examStatus, setExamStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const [examActive, setExamActive] = useState(false);
  const [socket, setSocket] = useState(null);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);

  useEffect(() => {
    fetchExamStatus();
    checkExamActive();

    // Initialize socket for real-time updates
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    if (user) {
      newSocket.emit('student-join', { userId: user.id });
    }

    // Listen for countdown start event
    newSocket.on('exam-countdown-started', (data) => {
      setExamActive(true);
      setShowCountdown(true);
      setCountdownSeconds(data.countdownSeconds);
      
      // Start countdown timer
      const countdownInterval = setInterval(() => {
        setCountdownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setShowCountdown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // Listen for actual exam start (after countdown)
    newSocket.on('exam-actually-started', (data) => {
      setShowCountdown(false);
      setCountdownSeconds(0);
    });

    // Listen for exam stop event
    newSocket.on('exam-stopped', () => {
      setExamActive(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchExamStatus = async () => {
    try {
      const data = await fetchClient('/exam/status');
      setExamStatus(data);
    } catch (error) {
      console.error('Failed to fetch exam status:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkExamActive = async () => {
    try {
      const data = await fetchClient('/exam/active');
      console.log('Exam active check:', data);
      setExamActive(data.isExamActive);
      
      // If exam is active when page loads, just log it
      if (data.isExamActive && !examActive) {
        console.log('Exam is currently active');
      }
    } catch (error) {
      // If error, exam is not active
      console.error('Failed to check exam active:', error);
      setExamActive(false);
    }
  };

  const handleStartExam = () => {
    // Skip rules page and go directly to exam
    navigate('/exam');
  };

  const handleResumeExam = () => {
    if (examStatus?.isDisqualified) {
      console.log('Cannot rejoin - disqualified');
      return;
    }
    navigate('/exam');
  };

  const handleViewResult = () => {
    navigate('/result');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ color: '#667eea', marginBottom: '20px' }}>Welcome, {user?.name}!</h2>
        
        <div className="dashboard-grid">
          <div className="stat-card">
            <h3>College</h3>
            <p style={{ fontSize: '20px' }}>{user?.collegeName}</p>
          </div>
          
          <div className="stat-card">
            <h3>Class</h3>
            <p>{user?.class}</p>
          </div>
          
          <div className="stat-card">
            <h3>Exam Status</h3>
            <p style={{ fontSize: '20px' }}>
              {user?.hasCompletedExam ? 'Completed' : 'Pending'}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          {!examStatus?.hasSession && !user?.hasCompletedExam && (
            <>
              {examActive ? (
                <div style={{ textAlign: 'center' }}>
                  {showCountdown && countdownSeconds > 0 ? (
                    <>
                      <h3 style={{ marginBottom: '20px', color: '#667eea', fontSize: '32px' }}>🎯 Exam Countdown Started!</h3>
                      <div style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                        borderRadius: '20px', 
                        padding: '40px', 
                        marginBottom: '30px',
                        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
                      }}>
                        <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '24px' }}>
                          Exam starts in:
                        </h2>
                        <div style={{ 
                          fontSize: '96px', 
                          fontWeight: 'bold', 
                          color: 'white',
                          fontFamily: 'monospace',
                          textShadow: '4px 4px 8px rgba(0,0,0,0.3)',
                          marginBottom: '20px'
                        }}>
                          {formatTime(countdownSeconds)}
                        </div>
                        <p style={{ color: 'white', fontSize: '18px', opacity: 0.9 }}>
                          Click "Join Exam Now" to enter the exam page
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 style={{ marginBottom: '20px', color: '#27ae60', fontSize: '28px' }}>🎯 Exam is Active!</h3>
                      <div className="warning-box" style={{ marginBottom: '20px', background: '#fff3cd', borderColor: '#ffc107' }}>
                        <h4 style={{ color: '#856404', fontSize: '20px' }}>⏰ Hurry! Join the exam now!</h4>
                        <p style={{ marginTop: '10px', color: '#856404', fontSize: '16px' }}>
                          Click the button below to join the exam.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="warning-box" style={{ marginBottom: '20px' }}>
                    <h4>Important Instructions:</h4>
                    <ul style={{ marginTop: '10px', lineHeight: '1.8', textAlign: 'left' }}>
                      <li>Stay in fullscreen mode throughout the exam</li>
                      <li>Do not switch tabs (max 3 warnings)</li>
                      <li>Each question has a time limit</li>
                      <li>Your answers are auto-saved</li>
                      <li>Questions change automatically for everyone</li>
                    </ul>
                  </div>
                  <button 
                    onClick={handleStartExam} 
                    className="btn btn-primary" 
                    style={{ 
                      fontSize: '24px', 
                      padding: '20px 60px', 
                      animation: 'pulse 1s infinite',
                      boxShadow: '0 8px 30px rgba(102, 126, 234, 0.5)'
                    }}
                  >
                    🚀 Join Exam Now
                  </button>
                </div>
              ) : (
                <>
                  <h3 style={{ marginBottom: '20px', color: '#e74c3c' }}>⏳ Waiting for admin to start the exam...</h3>
                  <p style={{ textAlign: 'center', color: '#666' }}>The exam has not been started yet. You will be notified automatically when it begins.</p>
                  <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9ff', borderRadius: '8px' }}>
                    <p style={{ margin: 0, color: '#667eea', fontWeight: 'bold' }}>
                      💡 No need to refresh! You'll get a notification when the exam starts.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {examStatus?.isActive && !examStatus?.isSubmitted && !examStatus?.isDisqualified && (
            <>
              <h3 style={{ marginBottom: '20px', color: '#e74c3c' }}>You have an exam in progress!</h3>
              <button onClick={handleResumeExam} className="btn btn-primary" style={{ fontSize: '18px', padding: '15px 40px' }}>
                Resume Exam
              </button>
            </>
          )}

          {examStatus?.isDisqualified && (
            <>
              <h3 style={{ marginBottom: '20px', color: '#e74c3c' }}>You have been disqualified</h3>
              <div className="warning-box" style={{ marginBottom: '20px' }}>
                <h4>Reason: {examStatus.disqualificationReason}</h4>
                <p>Your marks have been saved: {examStatus.finalScore} correct out of {examStatus.totalAnswered} answered</p>
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>You cannot rejoin the exam.</p>
              </div>
              <button onClick={handleViewResult} className="btn btn-primary" style={{ fontSize: '18px', padding: '15px 40px' }}>
                View Result
              </button>
            </>
          )}

          {user?.hasCompletedExam && (
            <>
              <h3 style={{ marginBottom: '20px', color: '#27ae60' }}>Exam Completed!</h3>
              <button onClick={handleViewResult} className="btn btn-primary" style={{ fontSize: '18px', padding: '15px 40px' }}>
                View Result
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
