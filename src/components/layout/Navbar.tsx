// src/components/layout/Navbar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  displayName?: string;
  profileImage?: string;
  role?: string;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // التحقق من حالة تسجيل الدخول عند تحميل المكون
    async function checkAuthStatus() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data: { user: User } = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAuthStatus();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        setUser(null);
        router.push('/');
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-purple-400">العوالم التسعة</span>
            </Link>
            <div className="hidden md:mr-6 md:flex md:space-x-8 md:space-x-reverse">
              <Link href="/" className="text-gray-300 hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium">
                الرئيسية
              </Link>
              <Link href="/novels" className="text-gray-300 hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium">
                الروايات
              </Link>
              <Link href="/categories" className="text-gray-300 hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium">
                التصنيفات
              </Link>
              <Link href="/rankings" className="text-gray-300 hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium">
                الترتيب
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="hidden md:mr-4 md:flex md:items-center">
              {loading ? (
                <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse"></div>
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={toggleMenu}
                    className="flex items-center text-gray-300 hover:text-purple-300 focus:outline-none"
                  >
                    <span className="ml-2">{user.displayName || user.username}</span>
                    {user.profileImage ? (
                      <Image
                        src={user.profileImage}
                        alt={user.username}
                        className="h-8 w-8 rounded-full"
                        width={32}
                        height={32}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
                        {(user.displayName || user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                  {isMenuOpen && (
                    <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        <Link href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-purple-300">
                          الملف الشخصي
                        </Link>
                        <Link href="/profile/library" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-purple-300">
                          مكتبتي
                        </Link>
                        {(user.role === 'author' || user.role === 'translator' || user.role === 'moderator' || user.role === 'admin' || user.role === 'owner') && (
                          <Link href="/novels/create" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-purple-300">
                            إنشاء رواية
                          </Link>
                        )}
                        {(user.role === 'moderator' || user.role === 'admin' || user.role === 'owner') && (
                          <Link href="/admin" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-purple-300">
                            لوحة الإدارة
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="block w-full text-right px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-purple-300"
                        >
                          تسجيل الخروج
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex space-x-4 space-x-reverse">
                  <Link href="/auth/login" className="text-gray-300 hover:text-purple-300 px-3 py-2 rounded-md text-sm font-medium">
                    تسجيل الدخول
                  </Link>
                  <Link href="/auth/register" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md text-sm font-medium">
                    إنشاء حساب
                  </Link>
                </div>
              )}
            </div>
            <div className="flex md:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
              >
                <span className="sr-only">فتح القائمة</span>
                <svg
                  className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg
                  className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* القائمة المنسدلة للهواتف */}
      <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link href="/" className="text-gray-300 hover:text-purple-300 block px-3 py-2 rounded-md text-base font-medium">
            الرئيسية
          </Link>
          <Link href="/novels" className="text-gray-300 hover:text-purple-300 block px-3 py-2 rounded-md text-base font-medium">
            الروايات
          </Link>
          <Link href="/categories" className="text-gray-300 hover:text-purple-300 block px-3 py-2 rounded-md text-base font-medium">
            التصنيفات
          </Link>
          <Link href="/rankings" className="text-gray-300 hover:text-purple-300 block px-3 py-2 rounded-md text-base font-medium">
            الترتيب
          </Link>
        </div>
        <div className="pt-4 pb-3 border-t border-gray-700">
          {!loading && (
            <div className="px-2 space-y-1">
              {user ? (
                <>
                  <div className="flex items-center px-3 py-2">
                    {user.profileImage ? (
                      <Image
                        src={user.profileImage}
                        alt={user.username}
                        className="h-10 w-10 rounded-full"
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center text-white">
                        {(user.displayName || user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="mr-3">
                      <div className="text-base font-medium text-white">{user.displayName || user.username}</div>
                    </div>
                  </div>
                  <Link href="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700">
                    الملف الشخصي
                  </Link>
                  <Link href="/profile/library" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700">
                    مكتبتي
                  </Link>
                  {(user.role === 'author' || user.role === 'translator' || user.role === 'moderator' || user.role === 'admin' || user.role === 'owner') && (
                    <Link href="/novels/create" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700">
                      إنشاء رواية
                    </Link>
                  )}
                  {(user.role === 'moderator' || user.role === 'admin' || user.role === 'owner') && (
                    <Link href="/admin" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700">
                      لوحة الإدارة
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="block w-full text-right px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700"
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700">
                    تسجيل الدخول
                  </Link>
                  <Link href="/auth/register" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-purple-300 hover:bg-gray-700">
                    إنشاء حساب
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
