import React, { useState } from 'react';
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from './firebaseConfig';

function ForgotPassword({ onSwitchMode }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordReset = async (event) => { /* ... como antes ... */ };

  return (
    <div className="auth-form-content"> {/* Adicionada classe base */}
      <h2>Recuperar Senha</h2>
      <p className="auth-form-subtitle">Informe seu e-mail para enviarmos um link de redefinição.</p>
      <form onSubmit={handlePasswordReset}>
        {/* ... campo email e botão ... */}
      </form>
      {error && <p className="auth-message error">{error}</p>}
      {success && <p className="auth-message success">{success}</p>}
      <div className="auth-switch-link">
        <button type="button" onClick={() => onSwitchMode('login')} className="link-button" disabled={isSubmitting}>Voltar para o Login</button>
      </div>
    </div>
  );
}
export default ForgotPassword;