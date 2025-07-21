import React, { useState } from "react";

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

const HomeIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const HeartIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
);

const TrophyIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
    />
  </svg>
);

const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="sticky top-0 z-[1000] w-screen m-0 p-0">
      {/* ガラスモーフィズム効果とグラデーション */}
      <div className="bg-gradient-to-r from-orange-400/95 via-pink-400/95 to-purple-500/95 backdrop-blur-xl border-b border-white/20">
        {/* 内側の光る効果 */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-white/10"></div>

        {/* メインコンテンツ */}
        <div className="relative flex items-center justify-between max-w-[1200px] mx-auto h-16 px-6 md:h-14 md:px-5">
          {/* ロゴセクション */}
          <div className="flex items-center">
            <div className="flex items-center gap-1 text-white no-underline group">
              <div className="relative">
                <img
                  src="/unitemate-logo.png"
                  alt="ユナメイト"
                  className="h-12 w-auto max-w-[220px] drop-shadow-md transition-all duration-300 group-hover:drop-shadow-lg group-hover:scale-105 md:h-9"
                />
                {/* ロゴの背景光効果 */}
                <div className="absolute inset-0 bg-white/20 rounded-lg blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 -z-10"></div>
              </div>
            </div>
          </div>

          {/* ナビゲーション */}
          <div className="flex-1 flex justify-center">
            <nav className="flex gap-2 items-center">
              <a
                href="/"
                className="group flex items-center gap-1.5 text-white/90 no-underline font-medium py-2 px-3.5 rounded-full
                         backdrop-blur-sm bg-white/10 border border-white/20
                         transition-all duration-300 ease-out
                         hover:bg-white/25 hover:border-white/40 hover:text-white hover:shadow-lg hover:shadow-white/25
                         hover:-translate-y-0.5 hover:scale-105
                         md:py-1.5 md:px-2.5 md:text-sm"
              >
                <HomeIcon />
                <span>トップ</span>
              </a>
              <a
                href="/match"
                className="group flex items-center gap-1.5 text-white/90 no-underline font-medium py-2 px-3.5 rounded-full
                         backdrop-blur-sm bg-white/10 border border-white/20
                         transition-all duration-300 ease-out
                         hover:bg-white/25 hover:border-white/40 hover:text-white hover:shadow-lg hover:shadow-white/25
                         hover:-translate-y-0.5 hover:scale-105
                         md:py-1.5 md:px-2.5 md:text-sm"
              >
                <HeartIcon />
                <span>マッチング</span>
              </a>
              <a
                href="/ranking"
                className="group flex items-center gap-1.5 text-white/90 no-underline font-medium py-2 px-3.5 rounded-full
                         backdrop-blur-sm bg-white/10 border border-white/20
                         transition-all duration-300 ease-out
                         hover:bg-white/25 hover:border-white/40 hover:text-white hover:shadow-lg hover:shadow-white/25
                         hover:-translate-y-0.5 hover:scale-105
                         md:py-1.5 md:px-2.5 md:text-sm"
              >
                <TrophyIcon />
                <span>ランキング</span>
              </a>
            </nav>
          </div>

          {/* ユーザーセクション */}
          <div className="flex items-center">
            {user ? (
              <div className="relative">
                <button
                  className="group flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white cursor-pointer py-2 px-3.5 rounded-full
                           transition-all duration-300 ease-out
                           hover:bg-white/25 hover:border-white/50 hover:shadow-lg hover:shadow-white/25 hover:-translate-y-0.5
                           md:gap-1.5 md:py-1.5 md:px-2.5"
                  onClick={toggleDropdown}
                >
                  <div className="relative">
                    <img
                      src={user.avatar || "/default-avatar.png"}
                      alt={user.username}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/30 transition-all duration-300 group-hover:ring-white/50 group-hover:scale-105 md:w-6 md:h-6"
                    />
                    {/* アバターの光る効果 */}
                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-sm"></div>
                  </div>
                  <span className="font-medium text-base md:text-sm">
                    {user.username}
                  </span>
                  <svg
                    className={`transition-all duration-300 ${
                      isDropdownOpen ? "rotate-180 text-white" : "text-white/70"
                    } group-hover:text-white`}
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>

                {/* ドロップダウンメニュー */}
                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 min-w-[160px] animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-xl shadow-black/20 border border-white/20 py-2 overflow-hidden">
                      {/* 内側の光る効果 */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-white/20 pointer-events-none"></div>

                      <div className="relative">
                        <a
                          href="/profile"
                          className="flex items-center gap-2 w-full py-2.5 px-3 text-gray-700 no-underline border-none bg-transparent text-left cursor-pointer
                                   transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-gray-900
                                   group"
                        >
                          <svg
                            className="w-2.5 h-2.5 text-gray-500 group-hover:text-blue-600 transition-colors duration-200"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span className="font-medium text-sm">
                            マイページ
                          </span>
                        </a>

                        <a
                          href="/settings"
                          className="flex items-center gap-2 w-full py-2.5 px-3 text-gray-700 no-underline border-none bg-transparent text-left cursor-pointer
                                   transition-all duration-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-blue-50 hover:text-gray-900
                                   group"
                        >
                          <svg
                            className="w-2.5 h-2.5 text-gray-500 group-hover:text-green-600 transition-colors duration-200"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="font-medium text-sm">設定</span>
                        </a>

                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-1.5 mx-3"></div>

                        <button
                          onClick={onLogout}
                          className="flex items-center gap-2 w-full py-2.5 px-3 text-red-600 font-semibold border-none bg-transparent text-left cursor-pointer
                                   transition-all duration-200 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-700
                                   group"
                        >
                          <svg
                            className="w-2.5 h-2.5 group-hover:scale-110 transition-transform duration-200"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          <span className="text-sm">ログアウト</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={onLogin}
                  className="group bg-white/20 backdrop-blur-sm text-white border border-white/40 py-2 px-5 rounded-full font-medium cursor-pointer
                           transition-all duration-300 ease-out transform
                           hover:bg-white hover:text-purple-600 hover:border-white hover:shadow-xl hover:shadow-white/30
                           hover:-translate-y-1 hover:scale-105
                           md:py-1.5 md:px-4 md:text-sm"
                >
                  <span className="relative z-10 text-base md:text-sm">
                    ログイン
                  </span>
                  {/* ボタンの光る効果 */}
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
