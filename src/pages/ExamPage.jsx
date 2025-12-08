import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../context/ExamContext';
import { useAuth } from '../context/AuthContext';
import fetchClient from '../utils/fetchClient';
import io from 'socket.io-client';

const ExamPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { examSession, setExamSession, questionIndex, setQuestionIndex } = useExam();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remainingTime, setRemainingTime] = useState(0);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(7);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(7);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [isCountdownPhase, setIsCountdownPhase] = useState(false);
  const [socket, setSocket] = useState(null);
  const timerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    initializeExam();
    enterFullscreen();
    setupEventListeners();
    
    // Initialize socket
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);
    
    if (user) {
      newSocket.emit('student-join', { userId: user.id });
    }

    newSocket.on('exam-stopped', () => {
      setWarningMessage('🛑 Exam has been stopped by admin. Redirecting...');
      setShowWarning(true);
      setTimeout(() => navigate('/'), 2000);
    });

    newSocket.on('exam-auto-stopped', (data) => {
      setWarningMessage('⏰ Exam time expired. Your exam has been submitted automatically.');
      setShowWarning(true);
      setTimeout(() => navigate('/'), 2000);
    });

    newSocket.on('global-question-change', (data) => {
      console.log('Global question changed to:', data.currentQuestion);
      setQuestionIndex(data.currentQuestion);
      setSelectedAnswer(null);
    });

    newSocket.on('exam-actually-started', (data) => {
      console.log('Exam actually started event received!', data);
      // Transition smoothly from countdown to exam
      setIsCountdownPhase(false);
      setCountdownSeconds(0);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      
      // Re-initialize immediately to load questions and start timer
      initializeExam();
    });

    newSocket.on('student-disqualified', (data) => {
      if (data.userId === user?.id) {
        setWarningMessage(`🚫 Disqualified: ${data.reason}. Redirecting to results...`);
        setShowWarning(true);
        setTimeout(() => navigate('/result'), 3000);
      }
    });
    
    return () => {
      cleanupEventListeners();
      if (timerRef.current) clearInterval(timerRef.current);
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Only load questions if session is active (not during countdown)
    if (examSession && !isCountdownPhase && !examSession.isWaiting) {
      loadQuestion(questionIndex);
      startQuestionTimer();
    }
  }, [questionIndex, examSession, isCountdownPhase]);

  const startQuestionTimer = () => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    
    setQuestionTimeRemaining(questionTimeLimit);
    
    questionTimerRef.current = setInterval(() => {
      setQuestionTimeRemaining(prev => {
        if (prev <= 1) {
          handleAutoNextQuestion();
          return questionTimeLimit;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAutoNextQuestion = () => {
    // Don't auto-advance - wait for global question change event
    // The server will emit 'global-question-change' event
    console.log('Waiting for global question change...');
  };

  const initializeExam = async () => {
    // Prevent multiple simultaneous calls
    if (initializingRef.current) {
      console.log('Already initializing, skipping...');
      return;
    }
    
    initializingRef.current = true;
    
    try {
      console.log('Initializing exam...');
      const statusData = await fetchClient('/exam/status');
      console.log('Exam status:', statusData);
      
      // Check if disqualified - cannot rejoin
      if (statusData.isDisqualified || statusData.cannotRejoin) {
        console.log('Disqualified:', statusData.disqualificationReason);
        console.log('Final score:', statusData.finalScore, '/', statusData.totalAnswered);
        navigate('/');
        return;
      }

      if (!statusData.hasSession) {
        console.log('No session found, starting exam...');
        const sessionData = await fetchClient('/exam/start', { method: 'POST' });
        console.log('Session created:', sessionData);
        
        // If waiting for countdown to finish, show countdown on exam page
        if (sessionData.isWaitingForStart) {
          // Calculate countdown from start time to show same number as admin
          const countdownStartTime = new Date(sessionData.countdownStartTime);
          const countdownDuration = sessionData.countdownDuration;
          const now = new Date();
          const elapsedSeconds = Math.floor((now - countdownStartTime) / 1000);
          const remainingSeconds = Math.max(0, countdownDuration - elapsedSeconds);
          
          console.log(`Joined during countdown. Showing ${remainingSeconds} seconds (same as admin)...`);
          
          // Show countdown on exam page
          setIsCountdownPhase(true);
          setCountdownSeconds(remainingSeconds);
          setLoading(false);
          setExamSession({ 
            ...sessionData, 
            isWaiting: true,
            waitSeconds: remainingSeconds
          });
          
          // Start countdown timer
          startCountdownTimer(remainingSeconds);
          
          // The socket listener will handle 'exam-actually-started' event
          return;
        }
        
        setExamSession(sessionData);
        
        // Calculate remaining time from global exam times
        const examStartTime = new Date(sessionData.startTime);
        const examEndTime = sessionData.globalEndTime ? new Date(sessionData.globalEndTime) : new Date(sessionData.endTime);
        const now = new Date();
        
        // If exam hasn't started yet (we're in countdown), calculate from start to end
        // Otherwise calculate from now to end
        let remainingSeconds;
        if (now < examStartTime) {
          // Exam hasn't started yet - use full duration
          remainingSeconds = Math.floor((examEndTime - examStartTime) / 1000);
        } else {
          // Exam is active - calculate remaining time
          remainingSeconds = Math.floor((examEndTime - now) / 1000);
        }
        
        setRemainingTime(remainingSeconds);
        setQuestionTimeLimit(sessionData.questionTimeLimit || 7);
        
        // Start from current global question if joining late
        if (sessionData.currentGlobalQuestion !== undefined) {
          setQuestionIndex(sessionData.currentGlobalQuestion);
          console.log('Starting from global question:', sessionData.currentGlobalQuestion);
        }
        
        startTimer(remainingSeconds);
        setLoading(false);
      } else if (statusData.isWaitingForStart) {
        console.log('Session waiting for exam to start...');
        
        // Calculate countdown from start time to show same number as admin
        if (statusData.countdownStartTime && statusData.countdownDuration) {
          const countdownStartTime = new Date(statusData.countdownStartTime);
          const countdownDuration = statusData.countdownDuration;
          const now = new Date();
          const elapsedSeconds = Math.floor((now - countdownStartTime) / 1000);
          const remainingSeconds = Math.max(0, countdownDuration - elapsedSeconds);
          
          setIsCountdownPhase(true);
          setCountdownSeconds(remainingSeconds);
          setLoading(false);
          setExamSession({ isWaiting: true });
          
          // Start countdown timer
          startCountdownTimer(remainingSeconds);
        } else {
          // Fallback to old method
          const actualStartTime = new Date(statusData.actualStartTime);
          const now = new Date();
          const waitSeconds = Math.floor((actualStartTime - now) / 1000);
          
          setIsCountdownPhase(true);
          setCountdownSeconds(waitSeconds);
          setLoading(false);
          setExamSession({ isWaiting: true });
          
          // Start countdown timer
          startCountdownTimer(waitSeconds);
        }
        
        // Wait for socket event
        return;
      } else if (statusData.isActive) {
        console.log('Resuming active session...');
        
        // Get exam control data for total questions
        const examControlData = await fetchClient('/exam/active');
        
        setExamSession({
          ...statusData,
          totalQuestions: examControlData.totalQuestions || statusData.totalQuestions || 5
        });
        setRemainingTime(statusData.remainingTime);
        setTabSwitchCount(statusData.tabSwitchCount);
        setQuestionIndex(statusData.currentQuestionIndex || 0);
        setQuestionTimeLimit(statusData.questionTimeLimit || examControlData.questionTimeLimit || 7);
        startTimer(statusData.remainingTime);
        setLoading(false);
      } else {
        console.log('Session not active, redirecting to result...');
        navigate('/result');
        return;
      }
    } catch (error) {
      console.error('Exam initialization error:', error);
      console.error('Error details:', error);
      
      // Don't navigate away immediately - show error
      setLoading(false);
      setWarningMessage('❌ Failed to initialize exam. Please contact admin.');
      setShowWarning(true);
      console.error('Failed to initialize exam:', error.message);
      
      // Navigate away after showing warning
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } finally {
      initializingRef.current = false;
    }
  };

  const loadQuestion = async (index) => {
    try {
      setLoading(true);
      const data = await fetchClient(`/exam/question/${index}`);
      setCurrentQuestion(data.question);
      setSelectedAnswer(data.selectedAnswer);
      setRemainingTime(data.remainingTime);
    } catch (error) {
      if (error.message.includes('expired') || error.message.includes('auto')) {
        setWarningMessage('⏰ Exam time expired. Submitting automatically...');
        setShowWarning(true);
        setTimeout(() => navigate('/result'), 2000);
      } else if (error.message.includes('not started yet') || error.message.includes('countdown')) {
        // Exam hasn't started yet - this is expected during countdown
        console.log('Exam not started yet, waiting...');
      } else {
        console.error('Failed to load question:', error.message);
        setWarningMessage('❌ Failed to load question. Please wait...');
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const startTimer = (seconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

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

  const handleAnswerSelect = async (optionId) => {
    setSelectedAnswer(optionId);
    
    try {
      await fetchClient('/exam/answer', {
        method: 'POST',
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedAnswer: optionId
        })
      });
    } catch (error) {
      console.error('Failed to save answer:', error);
    }
  };

  const handleNextQuestion = () => {
    // Manual next is disabled - questions change globally
    console.log('Questions change automatically for all students');
  };

  const handleSubmitExam = async () => {
    // Show confirmation in-page instead of using confirm()
    const userConfirmed = window.confirm('Are you sure you want to submit the exam? You cannot change answers after submission.');
    if (!userConfirmed) {
      return;
    }

    try {
      await fetchClient('/exam/submit', { method: 'POST' });
      setWarningMessage('✅ Exam submitted successfully! Redirecting to results...');
      setShowWarning(true);
      setTimeout(() => navigate('/result'), 2000);
    } catch (error) {
      console.error('Failed to submit exam:', error.message);
      setWarningMessage('❌ Failed to submit exam. Please try again.');
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
    }
  };

  const handleAutoSubmit = async () => {
    try {
      await fetchClient('/exam/submit', { method: 'POST' });
      navigate('/result');
    } catch (error) {
      console.error('Auto-submit failed:', error);
    }
  };

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log(err));
    }
  };

  const handleBeforeUnload = (e) => {
    // Prevent accidental page close/refresh
    e.preventDefault();
    e.returnValue = ''; // Chrome requires returnValue to be set
    return ''; // Some browsers require a return value
  };

  const setupEventListeners = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
  };

  const cleanupEventListeners = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };

  const handleVisibilityChange = async () => {
    if (document.hidden && !isCountdownPhase) {
      try {
        const response = await fetchClient('/log/tab-switch', { method: 'POST' });
        setTabSwitchCount(response.tabSwitchCount);
        
        if (response.autoSubmitted) {
          setWarningMessage('⚠️ Exam auto-submitted due to excessive tab switches!');
          setShowWarning(true);
          setTimeout(() => {
            navigate('/result');
          }, 2000);
        } else {
          setWarningMessage(`⚠️ WARNING: Tab switching is prohibited! (${response.tabSwitchCount}/${maxTabSwitches} violations)`);
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 5000);
        }
      } catch (error) {
        console.error('Failed to log tab switch:', error);
      }
    }
  };

  const handleFullscreenChange = async () => {
    const isNowFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isNowFullscreen);
    
    if (!isNowFullscreen && !isCountdownPhase) {
      try {
        const response = await fetchClient('/log/fullscreen-exit', { method: 'POST' });
        
        if (response.disqualified || response.cannotRejoin) {
          setWarningMessage(`🚫 DISQUALIFIED: You exited fullscreen mode! Your marks: ${response.score}/${response.totalAnswered}`);
          setShowWarning(true);
          setTimeout(() => {
            navigate('/');
          }, 3000);
          return;
        }
        
        setWarningMessage('⚠️ WARNING: Exiting fullscreen is prohibited! Returning to fullscreen...');
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000);
        enterFullscreen();
      } catch (error) {
        console.error('Failed to log fullscreen exit:', error);
      }
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">Loading exam...</div>;
  }

  // Show countdown phase on exam page
  if (isCountdownPhase) {
    return (
      <div className="exam-page" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh' }}>
        {showWarning && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff6b6b',
            color: 'white',
            padding: '15px 30px',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: 10000,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            animation: 'slideDown 0.3s ease-out'
          }}>
            {warningMessage}
          </div>
        )}
        
        <div style={{ textAlign: 'center', padding: '100px 20px', color: 'white' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px 40px', maxWidth: '700px', margin: '0 auto', color: '#333', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h1 style={{ color: '#667eea', marginBottom: '20px', fontSize: '42px', fontWeight: 'bold' }}>
              🎓 National Online Inter-College Olympiad 2025
            </h1>
            <p style={{ fontSize: '22px', color: '#27ae60', marginBottom: '40px', fontWeight: 'bold' }}>
              ✅ You have successfully joined the exam!
            </p>
            
            <div style={{ background: '#f8f9fa', borderRadius: '15px', padding: '40px', marginBottom: '30px' }}>
              <h2 style={{ color: '#667eea', marginBottom: '20px', fontSize: '24px' }}>
                Exam starts in:
              </h2>
              <div style={{ 
                fontSize: '96px', 
                fontWeight: 'bold', 
                color: countdownSeconds <= 10 ? '#e74c3c' : '#667eea',
                fontFamily: 'monospace',
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
              }}>
                {formatTime(countdownSeconds)}
              </div>
            </div>
            
            <div style={{ fontSize: '18px', color: '#666', lineHeight: '1.8', textAlign: 'left', background: '#fff3cd', padding: '20px', borderRadius: '10px', border: '2px solid #ffc107' }}>
              <p style={{ fontWeight: 'bold', color: '#e74c3c', marginBottom: '15px' }}>
                ⚠️ Important Instructions:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li>Stay on this page - the exam will start automatically</li>
                <li>Do not close, refresh, or switch tabs</li>
                <li>Keep your browser in fullscreen mode</li>
                <li>The page content will update smoothly when exam begins</li>
              </ul>
            </div>
            
            <div style={{ marginTop: '30px', fontSize: '16px', color: '#999' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#27ae60', borderRadius: '50%', marginRight: '8px', animation: 'pulse 2s infinite' }}></span>
              Connected and ready
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxTabSwitches = 3;
  const isLastQuestion = questionIndex === (examSession?.totalQuestions - 1);

  return (
    <div className="exam-page">
      {showWarning && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ff6b6b',
          color: 'white',
          padding: '15px 30px',
          borderRadius: '10px',
          fontSize: '18px',
          fontWeight: 'bold',
          zIndex: 10000,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          animation: 'slideDown 0.3s ease-out',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          {warningMessage}
        </div>
      )}

      <div className="timer">
        <h3>Time Remaining</h3>
        <div className={`timer-display ${remainingTime < 600 ? 'warning' : ''}`}>
          {formatTime(remainingTime)}
        </div>
        <div style={{ marginTop: '15px', padding: '10px', background: '#fff3cd', borderRadius: '6px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '5px' }}>Question Timer</h4>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: questionTimeRemaining <= 3 ? '#e74c3c' : '#333' }}>
            {questionTimeRemaining}s
          </div>
        </div>
        <p style={{ marginTop: '10px', fontSize: '14px' }}>
          Tab Switches: {tabSwitchCount}/{maxTabSwitches}
        </p>
      </div>

      <div className="container" style={{ marginTop: '20px' }}>
        <div className="card">
          {currentQuestion && (
            <>
              <div className="question-header">
                <h3>Question {questionIndex + 1} of {examSession?.totalQuestions}</h3>
                <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                  {currentQuestion.subject} | {currentQuestion.marks} mark
                </span>
              </div>

              <div className="question-container">
                <div className="question-text">{currentQuestion.text}</div>

                <div className="options-container">
                  {currentQuestion.options?.map((option) => (
                    <div
                      key={option.optionId}
                      className={`option ${selectedAnswer === option.optionId ? 'selected' : ''}`}
                      onClick={() => handleAnswerSelect(option.optionId)}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={option.optionId}
                        checked={selectedAnswer === option.optionId}
                        onChange={() => handleAnswerSelect(option.optionId)}
                      />
                      <span>{option.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="exam-controls">
                <div>
                  {selectedAnswer && (
                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✓ Answer saved</span>
                  )}
                </div>
                <div>
                  <p style={{ color: '#667eea', fontWeight: 'bold', margin: 0 }}>
                    ⏱️ Question will auto-advance in {questionTimeRemaining}s
                  </p>
                  {isLastQuestion && (
                    <button
                      onClick={handleSubmitExam}
                      className="btn btn-danger"
                      style={{ fontSize: '16px', padding: '12px 24px', marginTop: '10px' }}
                    >
                      Submit Exam Early
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamPage;
