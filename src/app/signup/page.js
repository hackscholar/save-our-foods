"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BrandLogo from "../components/BrandLogo";

const initialForm = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  phone: "",
  password: "",
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ error: null, success: null, loading: false });

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ error: null, success: null, loading: true });

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        const detail =
          data?.details && typeof data.details === "object"
            ? Object.values(data.details).join(" ")
            : null;
        throw new Error(detail ?? data?.error ?? "Unable to create account.");
      }

      setStatus({
        error: null,
        success: "Account created! Redirecting to login…",
        loading: false,
      });
      setForm(initialForm);
      setTimeout(() => router.push("/"), 800);
    } catch (error) {
      setStatus({ error: error.message, success: null, loading: false });
    }
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
            Create an account to start sharing and claiming groceries.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>First name</span>
            <input
              type="text"
              name="firstName"
              placeholder="Jane"
              required
              value={form.firstName}
              onChange={handleChange}
              disabled={status.loading}
            />
          </label>

          <label className="field">
            <span>Last name</span>
            <input
              type="text"
              name="lastName"
              placeholder="Doe"
              required
              value={form.lastName}
              onChange={handleChange}
              disabled={status.loading}
            />
          </label>

          <label className="field">
            <span>Username</span>
            <input
              type="text"
              name="username"
              placeholder="janedoe"
              required
              value={form.username}
              onChange={handleChange}
              disabled={status.loading}
            />
          </label>

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
            <span>Phone number</span>
            <input
              type="tel"
              name="phone"
              placeholder="+12065550123"
              required
              value={form.phone}
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
            {status.loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
