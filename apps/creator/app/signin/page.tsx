"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function SignInPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already signed in
    if (user && !loading) {
      router.push("/onboarding");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    try {
      await signIn();
      // Auth state change will trigger redirect via useEffect
    } catch (error) {
      // Silently handle popup errors - auth state observer will catch successful sign-ins
      console.error("Sign-in error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo/Brand */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Project Brayford</h1>
          <p className="mt-2 text-lg text-gray-600">
            Transform your live events into interactive experiences
          </p>
        </div>

        {/* Sign In Card */}
        <div className="bg-white py-12 px-8 shadow-lg rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Get Started
          </h2>
          <p className="text-gray-600 mb-8">
            Sign in with your Google account to create your organisation and
            start engaging your audience.
          </p>

          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Footer */}
        <p className="text-sm text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
