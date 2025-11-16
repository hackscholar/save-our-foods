"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BrandLogo from "./components/BrandLogo";

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ error: null, success: null, loading: false });

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleLogin(event) {
    event.preventDefault();
    setStatus({ error: null, success: null, loading: true });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to log in.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("smf_user", JSON.stringify(data.user));
        if (data.session) {
          window.localStorage.setItem("smf_session", JSON.stringify(data.session));
        }
      }

      setStatus({ error: null, success: "Login successful! Redirecting…", loading: false });
      setTimeout(() => router.push("/homepage"), 600);
    } catch (error) {
      setStatus({ error: error.message, success: null, loading: false });
    }
  }

  function handleGuest() {
    router.push("/homepage");
  }

  function handleSignupClick(event) {
    event.preventDefault();
    router.push("/signup");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-lockup">
          <div className="brand-name">
            <Image
              src="/headericon.PNG"
              alt="SaveMyFoods logo"
              width={350}
              height={150}
              className="logo"
            />
          </div>
          <BrandLogo />
          <p className="brand-tagline">
            A marketplace to share extra groceries and reduce food waste.
          </p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
              value={form.email}
              onChange={handleChange}
              disabled={status.loading}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={handleChange}
              disabled={status.loading}
            />
          </label>

          {status.error && <p className="helper-text error">{status.error}</p>}
          {status.success && <p className="helper-text success">{status.success}</p>}

          <button type="submit" className="primary-button wide" disabled={status.loading}>
            {status.loading ? "Signing in…" : "Log in"}
          </button>

          <button
            type="button"
            className="secondary-button wide"
            onClick={handleGuest}
            disabled={status.loading}
          >
            Continue as guest
          </button>

          <p className="helper-text">
            Don’t have an account?{" "}
            <a href="#" onClick={handleSignupClick}>
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
