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
    <>
      <BodyClass name="auth" />
      <main
        className="auth-shell login-shell"
        style={{ gridTemplateColumns: '1fr', width: 'min(440px, 100%)', minHeight: 0 }}
      >
        <section className="auth-card login-card">
          <div className="login-heading">
            <h2>LUZON A   MONITORING</h2>
          </div>
          <Notice ok={searchParams?.message} error={searchParams?.error} />
          <form action={login}>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" required autoComplete="username" placeholder="Your username" />
            <div className="password-label">
              <label htmlFor="password">Password</label>
            </div>
            <input id="password" type="password" name="password" required autoComplete="current-password" placeholder="Enter your password" />
            <button className="btn primary full">Log in <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-links">
          <Link href="/register">Create an account</Link>
          </p>
        </section>
      </main>
    </>
  );
}
