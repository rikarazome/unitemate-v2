import React from "react";
import Header from "./Header";

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
    <div className="min-h-screen flex flex-col">
      <Header user={user} onLogin={onLogin} onLogout={onLogout} />
      <main className="flex-1 p-8 max-w-[1200px] mx-auto w-full md:p-4">
        {children}
      </main>
    </div>
  );
};

export default Layout;
