import { Link } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'

import ClerkHeader from '../integrations/clerk/header-user'

import { useState } from 'react'
import {
  Building2,
  CalendarCheck,
  Home,
  Menu,
  Settings,
  X,
} from 'lucide-react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { isSignedIn } = useAuth()

  return (
    <>
      <header className="p-4 flex items-center justify-between bg-indigo-600 text-white shadow-lg">
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <Link to="/" className="ml-4 flex items-center gap-2">
            <Building2 size={28} />
            <span className="text-xl font-bold">Hotel Management</span>
          </Link>
        </div>
        {!isSignedIn && (
          <div className="flex items-center gap-2">
            <Link
              to="/sign-in"
              className="px-4 py-2 text-sm font-medium hover:bg-indigo-700 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/sign-up"
              className="px-4 py-2 text-sm font-medium bg-white text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        )}
        {isSignedIn && (
          <ClerkHeader />
        )}
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Building2 size={24} />
            <h2 className="text-xl font-bold">Menu</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors mb-2',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          {isSignedIn && (
            <>
              <Link
                to="/bookings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
                activeProps={{
                  className:
                    'flex items-center gap-3 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors mb-2',
                }}
              >
                <CalendarCheck size={20} />
                <span className="font-medium">My Bookings</span>
              </Link>

              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
                activeProps={{
                  className:
                    'flex items-center gap-3 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors mb-2',
                }}
              >
                <Settings size={20} />
                <span className="font-medium">Admin Dashboard</span>
              </Link>
            </>
          )}

          {!isSignedIn && (
            <>
              <Link
                to="/sign-in"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
              >
                <span className="font-medium">Sign In</span>
              </Link>
              <Link
                to="/sign-up"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
              >
                <span className="font-medium">Create Account</span>
              </Link>
            </>
          )}
        </nav>

        {isSignedIn && (
          <div className="p-4 border-t border-gray-700 bg-gray-800 flex flex-col gap-2">
            <ClerkHeader />
          </div>
        )}
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

