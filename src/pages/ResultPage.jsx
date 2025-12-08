import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fetchClient from '../utils/fetchClient';

const ResultPage = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchResult();
  }, []);

  const fetchResult = async () => {
    try {
      const data = await fetchClient('/exam/result');
      setResult(data);
    } catch (error) {
      // If disqualified, show their saved marks
      if (error.message.includes('not completed')) {
        try {
          const statusData = await fetchClient('/exam/status');
          if (statusData.isDisqualified) {
            setResult({
              score: statusData.finalScore || 0,
              totalQuestions: 200,
              correctAnswers: statusData.finalScore || 0,
              incorrectAnswers: statusData.totalAnswered - (statusData.finalScore || 0),
              rank: null,
              totalParticipants: null,
              submittedAt: new Date(),
              isDisqualified: true,
              disqualificationReason: statusData.disqualificationReason
            });
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }
      alert('Failed to fetch result: ' + error.message);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  if (!result) {
    return <div className="loading">No results found</div>;
  }

  const percentage = ((result.score / result.totalQuestions) * 100).toFixed(2);

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '800px', margin: '50px auto' }}>
        <h2 style={{ textAlign: 'center', color: result?.isDisqualified ? '#e74c3c' : '#667eea', marginBottom: '40px' }}>
          Exam Results
        </h2>

        {result?.isDisqualified ? (
          <div className="error" style={{ textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>
            <strong>⚠️ You were disqualified from the exam</strong>
            <p style={{ marginTop: '10px' }}>Reason: {result.disqualificationReason}</p>
            <p style={{ marginTop: '10px' }}>Your marks at the time of disqualification have been saved below.</p>
          </div>
        ) : (
          <div className="success" style={{ textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>
            Congratulations! You have successfully completed the exam.
          </div>
        )}

        <div className="dashboard-grid">
          <div className="stat-card">
            <h3>Total Score</h3>
            <p style={{ color: '#667eea' }}>{result.score}</p>
            <p style={{ fontSize: '16px', color: '#666' }}>out of {result.totalQuestions}</p>
          </div>

          <div className="stat-card">
            <h3>Percentage</h3>
            <p style={{ color: '#27ae60' }}>{percentage}%</p>
          </div>

          <div className="stat-card">
            <h3>Your Rank</h3>
            {result.isDisqualified ? (
              <p style={{ color: '#e74c3c', fontSize: '16px' }}>Not Ranked<br/>(Disqualified)</p>
            ) : (
              <>
                <p style={{ color: '#e74c3c' }}>#{result.rank}</p>
                <p style={{ fontSize: '16px', color: '#666' }}>out of {result.totalParticipants}</p>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9ff', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '20px', color: '#667eea' }}>Detailed Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <strong>Correct Answers:</strong>
              <span style={{ float: 'right', color: '#27ae60' }}>{result.correctAnswers}</span>
            </div>
            <div>
              <strong>Incorrect Answers:</strong>
              <span style={{ float: 'right', color: '#e74c3c' }}>{result.incorrectAnswers}</span>
            </div>
            <div>
              <strong>Total Questions:</strong>
              <span style={{ float: 'right' }}>{result.totalQuestions}</span>
            </div>
            <div>
              <strong>Submitted At:</strong>
              <span style={{ float: 'right' }}>{new Date(result.submittedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <button onClick={() => navigate('/')} className="btn btn-primary" style={{ fontSize: '18px', padding: '15px 40px' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
