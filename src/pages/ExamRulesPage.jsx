import React from 'react';
import { useNavigate } from 'react-router-dom';

const ExamRulesPage = () => {
  const navigate = useNavigate();

  const handleAccept = () => {
    navigate('/exam');
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '900px', margin: '30px auto' }}>
        <h2 style={{ color: '#667eea', marginBottom: '30px', textAlign: 'center' }}>
          Exam Rules & Instructions
        </h2>

        <div className="warning-box">
          <h4>IMPORTANT: Please read carefully before starting</h4>
        </div>

        <ul className="rules-list">
          <li>The exam duration is 180 minutes (3 hours)</li>
          <li>Total questions: 200 Multiple Choice Questions (MCQs)</li>
          <li>Each question carries 1 mark</li>
          <li>Questions will be displayed one at a time</li>
          <li>You cannot go back to previous questions</li>
          <li>Your answers are auto-saved immediately</li>
          <li>The exam must be taken in fullscreen mode</li>
          <li>Switching tabs is strictly prohibited (Maximum 3 warnings allowed)</li>
          <li>After 3 tab switches, your exam will be auto-submitted</li>
          <li>The exam will auto-submit when the timer expires</li>
          <li>You can only take the exam from one device</li>
          <li>Your IP address and device information will be logged</li>
          <li>If you refresh the page, you can resume from where you left off</li>
          <li>Ensure stable internet connection throughout the exam</li>
          <li>Do not close the browser or navigate away from the exam page</li>
        </ul>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ marginRight: '20px' }}>
            Go Back
          </button>
          <button onClick={handleAccept} className="btn btn-primary" style={{ fontSize: '18px', padding: '15px 40px' }}>
            I Accept - Start Exam
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamRulesPage;
