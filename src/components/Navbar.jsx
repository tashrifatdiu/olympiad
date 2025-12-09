import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdminPage = window.location.pathname.startsWith('/admin-panel');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show navbar on admin pages
  if (isAdminPage) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <h1>National Online Inter-College Olympiad 2025</h1>
        <div className="navbar-links">
          {user ? (
            <>
              <span>Welcome, {user.name}</span>
              <Link to="/">Dashboard</Link>
              <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
