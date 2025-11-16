// src/app/page.js

export default function Home() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-lockup">
          <div className="brand-name">
            <span className="brand-main">Save</span>
            <span className="brand-circle">my</span>
            <span className="brand-main">Foods</span>
          </div>
          <p className="brand-tagline">
            A marketplace to share extra groceries and reduce food waste.
          </p>
        </div>

        <form className="login-form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </label>

          <button type="submit" className="primary-button wide">
            Log in
          </button>

          <button type="button" className="secondary-button wide">
            Continue as guest
          </button>

          <p className="helper-text">
            Don’t have an account? <a href="#">Sign up</a>
          </p>
        </form>
      </div>
    </div>
  );
}
