"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(#9B4A1E 1px, transparent 1px), linear-gradient(90deg, #9B4A1E 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="4" fill="#000000"/>
              <path d="M5,5 L21,5 C23,9 19,14 16,14 C13,14 3,17 5,21 Z" fill="#FFFFFF"/>
              <path d="M27,11 C29,15 19,18 16,18 C13,18 9,23 11,27 L27,27 Z" fill="#FFFFFF"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Paggo Fraud Detection</h1>
          <p className="text-gray-400 text-sm mt-1">
            Restricted access — authorized analysts only
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#141414] border border-[#2A2A2A]/50 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
          <p className="text-sm text-gray-400 mb-6">
            Sign in to start investigating
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@paggo.com"
                  required
                  className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#9B4A1E] focus:ring-1 focus:ring-[#9B4A1E] transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#9B4A1E] focus:ring-1 focus:ring-[#9B4A1E] transition-colors"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#9B4A1E] hover:bg-[#C4622A] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Demo credentials toggle */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowCredentials(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#1C1C1C]/50 rounded-lg border border-[#2A2A2A]/50 text-xs text-gray-500 hover:text-gray-400 hover:bg-[#1C1C1C] transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{"🔑"}</span>
                <span>Demo credentials</span>
              </span>
              <span className={`transition-transform duration-200 ${showCredentials ? 'rotate-180' : ''}`}>
                {"▾"}
              </span>
            </button>

            {showCredentials && (
              <div className="mt-2 px-3 py-2 bg-[#1C1C1C]/30 rounded-lg border border-[#2A2A2A]/30">
                <p className="text-xs text-gray-400 font-mono">
                  analyst@paggo.com
                </p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  paggo2025
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Paggo Fraud Detection System — Confidential
        </p>
      </div>
    </div>
  );
}
