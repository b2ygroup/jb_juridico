import React, { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from './firebaseConfig';
// AuthForms.css é importado em App.js

function Login({ onSwitchMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Login.js: Erro no login:", err);
      let errorMessage = 'Ocorreu um erro ao tentar fazer login.';
      if (err && typeof err === 'object') {
        const errCode = err.code;
        if (errCode === 'auth/user-not-found' || errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
          errorMessage = 'E-mail ou senha inválidos.';
        } else if (errCode === 'auth/invalid-email') {
          errorMessage = 'Formato de e-mail inválido.';
        } else if (err.message) {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-form-content"> {/* Adicionada classe base */}
      <h2>Acessar Plataforma</h2>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="login-email-main">Email:</label>
          <input type="email" id="login-email-main" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seuemail@dominio.com" disabled={isSubmitting}/>
        </div>
        <div className="form-group">
          <label htmlFor="login-password-main">Senha:</label>
          <input type="password" id="login-password-main" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="********" disabled={isSubmitting}/>
        </div>
        <div className="form-options">
          <button type="button" onClick={() => onSwitchMode('forgotPassword')} className="link-button small-text" disabled={isSubmitting}>
            Esqueceu sua senha?
          </button>
        </div>
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      {error && <p className="auth-message error">{error}</p>}
      <div className="auth-switch-link">
        Não tem uma conta?{' '}
        <button type="button" onClick={() => onSwitchMode('signup')} className="link-button" disabled={isSubmitting}>
          Cadastre-se
        </button>
      </div>
    </div>
  );
}
export default Login;