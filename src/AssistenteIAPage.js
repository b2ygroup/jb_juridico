import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Removido Link se não usado diretamente para navegação
import { getFunctions, httpsCallable, FunctionsError, connectFunctionsEmulator } from "firebase/functions";
import './NovoProcessoPage.css'; // Reutilizando estilos de formulário
import './AssistenteIAPage.css'; // Estilos específicos para esta página (crie este arquivo)

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const SendIcon = () => <span style={{ marginLeft: '0.5em' }}>&#10148;</span>; 
const SparkleIcon = () => <span style={{ marginRight: '0.5em' }}>✨</span>;

const functionsInstance = getFunctions();
if (process.env.NODE_ENV === 'development') {
  try {
    connectFunctionsEmulator(functionsInstance, "localhost", 5001);
    console.log("AssistenteIAPage: Funções conectadas ao emulador na porta 5001.");
  } catch (e) {
    console.warn("AssistenteIAPage: Não foi possível conectar ao emulador de functions. A função será chamada na nuvem.", e);
  }
}

function AssistenteIAPage() {
  const navigate = useNavigate();
  const [pergunta, setPergunta] = useState('');
  const [respostaIA, setRespostaIA] = useState('');
  const [loadingIA, setLoadingIA] = useState(false);
  const [erroIA, setErroIA] = useState(null);

  const handleSubmitPergunta = async (event) => {
    event.preventDefault();
    if (!pergunta.trim()) {
      setErroIA("Por favor, digite sua pergunta.");
      return;
    }
    setLoadingIA(true);
    setErroIA(null);
    setRespostaIA('');

    try {
      const askAIAssistantFunc = httpsCallable(functionsInstance, 'askAIAssistant');
      console.log("Chamando Cloud Function 'askAIAssistant'...");
      const result = await askAIAssistantFunc({ question: pergunta });
      console.log("Resultado da Cloud Function:", result);

      const assistantData = result.data;
      const answer = (assistantData && typeof assistantData === 'object' && typeof assistantData.answer === 'string')
                      ? assistantData.answer
                      : null;

      if (answer) {
        setRespostaIA(answer);
      } else {
        throw new Error("A resposta da IA não continha um formato esperado.");
      }
    } catch (err) {
      console.error("Erro ao chamar a Cloud Function do Assistente:", err);
      let errorMessage = "Ocorreu um erro ao contatar o assistente.";
      if (err instanceof FunctionsError) {
        errorMessage = `Erro (${err.code}): ${err.message}`;
        if (err.details) { console.error("Detalhes do erro:", err.details); }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setErroIA(errorMessage);
    } finally {
      setLoadingIA(false);
    }
  };

  return (
    <div className="novo-processo-page assistente-ia-page">
      <div className="page-header">
        <h2 className="page-title"><SparkleIcon />Assistente Virtual Jurídico</h2>
        <button onClick={() => navigate('/')} className="button-secondary-alt">
          <BackArrowIcon /> Voltar ao Dashboard
        </button>
      </div>

      <div className="processo-form-card assistente-chat-area">
        <form onSubmit={handleSubmitPergunta} className="pergunta-form">
          <div className="form-group full-width">
            <label htmlFor="perguntaUsuario">Faça sua pergunta jurídica:</label>
            <textarea
              id="perguntaUsuario"
              rows="4"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Digite aqui sua dúvida ou consulta jurídica geral..."
              disabled={loadingIA}
            />
          </div>
          <div className="form-actions" style={{ justifyContent: 'center' }}>
            <button type="submit" className="button-primary-alt" disabled={loadingIA}>
              {loadingIA ? 'Pensando...' : 'Perguntar à IA'} <SendIcon />
            </button>
          </div>
        </form>

        {(loadingIA || erroIA || respostaIA) && (
          <div className="resposta-ia-container">
            {loadingIA && <p className="loading-message small-loading">Aguarde, consultando inteligência jurídica...</p>}
            {erroIA && <p className="form-feedback error">{erroIA}</p>}
            {respostaIA && (
              <div className="resposta-ia-content">
                <h4>Resposta do Assistente:</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{respostaIA}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssistenteIAPage;