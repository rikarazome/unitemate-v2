import React, { useState } from 'react';
import './Header.css';

interface User {
  id: string;
  username: string;
  avatar?: string;
}

interface HeaderProps {
  user?: User;
  onLogin?: () => void;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <div className="logo">
            <img src="/unitemate-logo.png" alt="ユナメイト" className="logo-image" />
          </div>
        </div>

        <div className="header-center">
          <nav className="nav-links">
            <a href="/" className="nav-link">トップ</a>
            <a href="/match" className="nav-link">マッチング</a>
            <a href="/ranking" className="nav-link">ランキング</a>
          </nav>
        </div>

        <div className="header-right">
          {user ? (
            <div className="user-menu">
              <button className="user-button" onClick={toggleDropdown}>
                <img 
                  src={user.avatar || '/default-avatar.png'} 
                  alt={user.username} 
                  className="user-avatar"
                />
                <span className="username">{user.username}</span>
                <svg 
                  className={`dropdown-icon ${isDropdownOpen ? 'open' : ''}`}
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </button>
              
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <a href="/profile" className="dropdown-item">マイページ</a>
                  <a href="/settings" className="dropdown-item">設定</a>
                  <hr className="dropdown-divider" />
                  <button onClick={onLogout} className="dropdown-item logout-button">
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="guest-menu">
              <button onClick={onLogin} className="login-button">
                ログイン
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;