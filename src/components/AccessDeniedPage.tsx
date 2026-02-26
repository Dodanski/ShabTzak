import { useAuth } from '../context/AuthContext'

export default function AccessDeniedPage() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-olive-50 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <h1 className="text-2xl font-bold text-olive-800">Access Denied</h1>
        <p className="text-olive-600">Your account is not authorized to access this application.</p>
        <p className="text-olive-500 text-sm">Contact your admin to get access.</p>
        <button
          onClick={signOut}
          className="px-4 py-2 bg-olive-700 text-white rounded-lg hover:bg-olive-800"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
