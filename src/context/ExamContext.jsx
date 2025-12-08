import React, { createContext, useState, useContext } from 'react';

const ExamContext = createContext();

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within ExamProvider');
  }
  return context;
};

export const ExamProvider = ({ children }) => {
  const [examSession, setExamSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  return (
    <ExamContext.Provider value={{
      examSession,
      setExamSession,
      currentQuestion,
      setCurrentQuestion,
      questionIndex,
      setQuestionIndex,
      remainingTime,
      setRemainingTime
    }}>
      {children}
    </ExamContext.Provider>
  );
};
