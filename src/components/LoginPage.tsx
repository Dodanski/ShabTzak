import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { auth, signIn } = useAuth()

  return (
    <div className="min-h-screen bg-olive-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg border border-olive-200 p-10 flex flex-col items-center gap-5 w-full max-w-sm">

        {/* IDF emblem */}
        <img
          src="/logo-idf.jpeg"
          alt="IDF"
          className="h-24 w-24 object-contain"
        />

        {/* Unit logo */}
        <img
          src="/logo-unit.jpg"
          alt="זאבי הגבעה"
          className="h-16 w-16 object-contain"
        />

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-olive-800">ShabTzak</h1>
          <p className="text-olive-600 text-sm mt-1 font-medium" dir="rtl">
            מערכת ניהול סידור שירות
          </p>
        </div>

        {auth.error && (
          <div
            role="alert"
            className="w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700"
          >
            {auth.error}
          </div>
        )}

        <button
          onClick={signIn}
          className="w-full py-2 px-4 bg-olive-700 text-white rounded-lg hover:bg-olive-800 transition-colors font-medium"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
