import React from 'react';
import { LogIn, LogOut, Package2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

interface NavbarProps {
  user: User | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-4 md:px-8 h-16 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <Package2 size={24} />
        </div>
        <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">Vardhaman Sales Corp</span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{user.displayName}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.email}</p>
            </div>
            <img 
              src={user.photoURL || ''} 
              alt={user.displayName || 'User'} 
              className="w-10 h-10 rounded-xl border-2 border-white shadow-md"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-400 transition-all active:scale-95"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="flex items-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95"
          >
            <LogIn size={20} />
            <span>Login</span>
          </button>
        )}
      </div>
    </nav>
  );
};
