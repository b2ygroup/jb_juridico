import React from 'react';
import './SplashScreen.css'; // CSS totalmente novo abaixo

function SplashScreen() {
  return (
    <div className="splash-screen-visionary">
      <div className="splash-grid-background"></div> {/* Para efeito de grid de fundo */}
      <div className="splash-logo-container">
        <span className="splash-logo-char char-j">J</span>
        <span className="splash-logo-char char-b">B</span>
      </div>
      <div className="splash-text-container">
        <h1 className="splash-main-title">INTELIGÊNCIA JURÍDICA</h1>
        <p className="splash-sub-action">EM AÇÃO</p>
      </div>
      <div className="splash-loader-bar-container">
        <div className="splash-loader-bar"></div>
      </div>
    </div>
  );
}

export default SplashScreen;