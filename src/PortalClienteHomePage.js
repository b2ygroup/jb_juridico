import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // useNavigate removido se não usado diretamente
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore"; // Importações do Firestore
import { db, auth } from './firebaseConfig';
import './Dashboard.css'; 
import './App.css'; 
import './PortalClienteHomePage.css'; 

const PlusIcon = () => <span style={{ fontSize: '1em', marginRight: '0.3em' }}>&#43;</span>;
const ListIcon = () => <span style={{ fontSize: '1.1em', marginRight: '0.5em' }}>&#128220;</span>;

// Função formatDate (se não estiver global, defina ou importe)
const formatDateSimple = (timestamp) => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return '-';
};


function PortalClienteHomePage() {
  const currentUser = auth.currentUser;
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(true);
  const [errorOcorrencias, setErrorOcorrencias] = useState(null);

  useEffect(() => {
    if (currentUser) {
      setLoadingOcorrencias(true);
      setErrorOcorrencias(null);
      console.log("PortalClienteHomePage: Buscando ocorrências para cliente ID:", currentUser.uid);

      const ocorrenciasRef = collection(db, "ocorrencias");
      const q = query(
        ocorrenciasRef,
        where("clienteId", "==", currentUser.uid),
        orderBy("criadoEm", "desc") // Mais recentes primeiro
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const itensData = [];
        querySnapshot.forEach((doc) => {
          itensData.push({ id: doc.id, ...doc.data() });
        });
        setOcorrencias(itensData);
        setLoadingOcorrencias(false);
        console.log("PortalClienteHomePage: Ocorrências carregadas:", itensData.length);
      }, (error) => {
        console.error("PortalClienteHomePage: Erro ao buscar ocorrências: ", error);
        setErrorOcorrencias("Não foi possível carregar suas ocorrências. Tente recarregar a página.");
        setLoadingOcorrencias(false);
      });

      return () => unsubscribe(); // Limpa o listener ao desmontar
    } else {
      setOcorrencias([]); // Limpa ocorrências se não houver usuário
      setLoadingOcorrencias(false);
    }
  }, [currentUser]); // Re-busca se o usuário mudar

  return (
    <div className="portal-cliente-page-container">
      <div className="portal-cliente-header-main">
        <h1>Meu Portal</h1>
        <p>Bem-vindo(a), {currentUser?.displayName || currentUser?.email || 'Cliente'}! Acompanhe seus casos e solicite assistência.</p>
      </div>

      <section className="portal-cliente-section">
        <div className="portal-card-header">
          <h3><ListIcon />Minhas Solicitações/Ocorrências</h3>
          <Link to="/portal-cliente/nova-ocorrencia" className="button-primary-alt small-button">
            <PlusIcon /> Relatar Novo Caso
          </Link>
        </div>
        <div className="portal-card-content">
          {loadingOcorrencias ? (
            <p className="loading-text-portal">Carregando suas ocorrências...</p>
          ) : errorOcorrencias ? (
            <p className="form-feedback error">{errorOcorrencias}</p>
          ) : ocorrencias.length > 0 ? (
            <ul className="info-list-styled-portal">
              {ocorrencias.map(ocorrencia => (
                <li key={ocorrencia.id}>
                  {/* TODO: Link para detalhe da ocorrência (ex: /portal-cliente/ocorrencia/${ocorrencia.id}) */}
                  <div style={{flexGrow: 1}}>
                    <span className="info-title-portal">{ocorrencia.titulo}</span>
                    <small style={{display: 'block', color: 'var(--cor-texto-claro-secundario, #94a3b8)', fontSize: '0.8em'}}>
                      Enviada em: {formatDateSimple(ocorrencia.criadoEm)} - Protocolo: {ocorrencia.id.substring(0,8).toUpperCase()}
                    </small>
                  </div>
                  <span 
                    className={`info-tag-portal status-${(ocorrencia.statusOcorrencia || 'enviada').toLowerCase().replace(/\s+/g, '-')}`}
                    title={`Status: ${ocorrencia.statusOcorrencia}`}
                  >
                    {ocorrencia.statusOcorrencia || "Enviada"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state-portal">
              Você ainda não possui nenhuma ocorrência registrada. <br/>
              Clique em "Relatar Novo Caso" para começar.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default PortalClienteHomePage;