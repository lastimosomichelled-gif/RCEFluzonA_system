import Link from 'next/link';
import { redirect } from 'next/navigation';
import { me } from '@/lib/auth';
import { login } from './actions';
import BodyClass from '@/components/BodyClass';
import Notice from '@/components/Notice';

export const metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }) {
  if (await me()) redirect('/dashboard');
  return (
        <section className="auth-card login-card">
          <div className="login-heading">
            <span className="login-kicker">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Enter your username and password to continue.</p>
          </div>
          <Notice ok={searchParams?.message} error={searchParams?.error} />
          <form action={login}>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" required autoComplete="username" placeholder="Your username" />
            <div className="password-label">
              <label htmlFor="password">Password</label>
              <Link href="/forgot_password">Forgot password?</Link>
            </div>
            <input id="password" type="password" name="password" required autoComplete="current-password" placeholder="Enter your password" />
            <button className="btn primary full">Log in <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-links">
            New to RCEF Monitor? <Link href="/register">Create an account</Link>
          </p>
          <p className="login-note">Access is for Luzon A.</p>
        </section>
      </main>
    </>
  );
}
