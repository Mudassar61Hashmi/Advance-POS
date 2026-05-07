import React, { useState } from "react";
import type { User } from "../types";
import { LogIn, Shield, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { getPresetPalette, useThemeConfig } from "../theme";

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { isDark, preset } = useThemeConfig();
  const palette = getPresetPalette(preset);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // ✅ Save token + user to localStorage so authenticated API calls work
        localStorage.setItem(
          "pos_user",
          JSON.stringify({
            token: data.token,
            ...data.user,
          })
        );
        onLogin(data.user);
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Connection error — make sure the server is running");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 font-sans"
      style={{
        background: isDark
          ? `radial-gradient(circle at 10% 10%, ${palette.accent}33, transparent 35%), radial-gradient(circle at 90% 20%, ${palette.accentSoft}33, transparent 35%), #0a0f1a`
          : `radial-gradient(circle at 10% 10%, ${palette.accent}2e, transparent 35%), radial-gradient(circle at 90% 20%, ${palette.accentSoft}26, transparent 35%), #f5f7fb`,
      }}
    >
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: isDark ? "#131c2e" : "#fff", border: `1px solid ${isDark ? "#2a3a56" : "#00000012"}` }}>
        <div className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-black/20" style={{ background:`linear-gradient(135deg, ${palette.accent}, ${palette.accentSoft})` }}>
              <Shield className="text-white w-8 h-8" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-center mb-2 tracking-tight" style={{ color: isDark ? "#eef4ff" : "#101828" }}>
            Welcome Back
          </h1>
          <p className="text-center mb-8 text-sm" style={{ color: isDark ? "#9eb0cf" : "#667085" }}>
            Sign in to your POS account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 ml-1" style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }}>
                Username or Email
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border rounded-xl focus:ring-0 transition-all outline-none text-sm"
                  style={{ background: isDark ? "#0f1728" : "#f9fafb", borderColor: isDark ? "#24324a" : "transparent", color: isDark ? "#eef4ff" : "#101828" }}
                  placeholder="Enter username or email"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 ml-1" style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }}>
                Password
              </label>
              <div className="relative">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 border rounded-xl focus:ring-0 transition-all outline-none text-sm"
                  style={{ background: isDark ? "#0f1728" : "#f9fafb", borderColor: isDark ? "#24324a" : "transparent", color: isDark ? "#eef4ff" : "#101828" }}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 mt-4 shadow-lg shadow-black/10"
              style={{ background:`linear-gradient(135deg, ${palette.accent}, ${palette.accentSoft})` }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t flex items-center justify-between" style={{ background: isDark ? "#0f1728" : "#f9fafb", borderColor: isDark ? "#24324a" : "#00000012" }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }}>
            Secure POS Terminal v1.0
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-medium" style={{ color: isDark ? "#8fa2c3" : "#98a2b3" }}>Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};