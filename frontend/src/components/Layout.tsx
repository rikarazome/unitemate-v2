import React from "react";
import Header from "./Header";
import "./Layout.css";

interface User {
  id: string;
  username: string;
  avatar?: string;
}

interface LayoutProps {
  children: React.ReactNode;
  user?: User;
  onLogin?: () => void;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  onLogin,
  onLogout,
}) => {
  return (
    <div className="layout">
      <Header user={user} onLogin={onLogin} onLogout={onLogout} />
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
