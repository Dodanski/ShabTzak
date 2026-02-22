import React from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-80">
        <h1 className="text-3xl font-bold text-blue-600">ShabTzak</h1>
        <p className="text-gray-500 text-sm text-center">
          Soldier scheduling made simple
        </p>
        <button
          onClick={signIn}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
