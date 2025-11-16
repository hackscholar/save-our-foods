"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "../components/BrandLogo";

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ loading: false, error: null, success: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("smf_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setForm({
          firstName: parsed.firstName ?? "",
          lastName: parsed.lastName ?? "",
          email: parsed.email ?? "",
          phone: parsed.phone ?? "",
          password: "",
        });
      }
    } catch (error) {
      console.error("Failed to load saved user", error);
    }
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user?.id) {
      setStatus({ loading: false, error: "Please sign in again.", success: null });
      return;
    }

    setStatus({ loading: true, error: null, success: null });

    const payload = {
      userId: user.id,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
    };
    if (form.password) {
      payload.password = form.password;
    }

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail =
          data?.details && typeof data.details === "object"
            ? Object.values(data.details).join(" ")
            : null;
        throw new Error(detail ?? data?.error ?? "Unable to update profile.");
      }

      setUser(data.user);
      setStatus({ loading: false, error: null, success: "Profile updated!" });
      setForm((prev) => ({ ...prev, password: "" }));
      if (typeof window !== "undefined") {
        window.localStorage.setItem("smf_user", JSON.stringify(data.user));
      }
      router.push("/homepage");
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: null });
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-lockup">
          <BrandLogo />
          <p className="brand-tagline">Edit your profile information.</p>
        </div>

        {user ? (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Username (read-only)</span>
              <input type="text" value={user.username ?? ""} disabled />
            </label>

            <label className="field">
              <span>First name</span>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                disabled={status.loading}
              />
            </label>

            <label className="field">
              <span>Last name</span>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                disabled={status.loading}
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={status.loading}
              />
            </label>

            <label className="field">
              <span>Phone number</span>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+12065550123"
                disabled={status.loading}
              />
            </label>

            <label className="field">
              <span>New password (optional)</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current password"
                disabled={status.loading}
              />
            </label>

            {status.error && <p className="helper-text error">{status.error}</p>}
            {status.success && <p className="helper-text success">{status.success}</p>}

            <button type="submit" className="primary-button wide" disabled={status.loading}>
              {status.loading ? "Saving…" : "Save changes"}
            </button>
          </form>
        ) : (
          <p className="helper-text">Sign in first to manage your information.</p>
        )}
      </div>
    </div>
  );
}
