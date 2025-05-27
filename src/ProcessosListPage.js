import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore"; 
import { db, auth } from './firebaseConfig'; 
import './ProcessosListPage.css'; 

const PlusIcon = () => <span style={{fontSize: '1em', marginRight: '0.3em'}}>&#43;</span>;

// Função formatDate
const formatDate = (timestamp) => {
  if (timestamp && typeof timestamp.toDate === 'function') { 
    return timestamp.toDate().toLocaleDateString('pt-BR'); 
  } else if (timestamp instanceof Date) { 
     return timestamp.toLocaleDateString('pt-BR');
  }
  return '-'; 
};

function ProcessosListPage() {
  const [processos, setProcessos] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 

  // --- useEffect SIMPLIFICADO ---
  useEffect(() => {
    setLoading(true);
    setError(null);
    setProcessos([]); 

    const currentUser = auth.currentUser; // Pega o usuário atual

    if (currentUser) {
      console.log("ProcessosListPage: User ID:", currentUser.uid); // Log UID
      // Cria a query diretamente
      const q = query(
        collection(db, "processos"), 
        where("userId", "==", currentUser.uid), 
        orderBy("criadoEm", "desc") 
      );
      console.log("ProcessosListPage: Query criada.");

      // Configura o listener onSnapshot
      const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
        console.log("ProcessosListPage: Snapshot recebido. Vazio?", querySnapshot.empty);
        const processosData = [];
        querySnapshot.forEach((doc) => {
          processosData.push({ id: doc.id, ...doc.data() });
        });
        setProcessos(processosData); 
        setLoading(false); 
      }, (err) => { 
        console.error("ProcessosListPage: Erro no listener:", err); 
        // Mensagem de erro específica para índice
         if (err.code === 'failed-precondition') {
             setError("Erro: Índice necessário não encontrado no Firestore. Verifique o console do navegador (F12) para um link de criação de índice ou crie manualmente um índice composto para 'userId' (asc) e 'criadoEm' (desc) na coleção 'processos'.");
         } else {
             setError("Não foi possível carregar os processos.");
         }
        setLoading(false);
      });

      // Retorna a função de limpeza para o listener do snapshot
      return () => {
          console.log("ProcessosListPage: Limpando listener snapshot.");
          unsubscribeSnapshot();
      }

    } else {
      // Este caso não deveria ocorrer devido ao ProtectedRoute, mas é seguro ter
      console.warn("ProcessosListPage: Nenhum usuário logado no momento da montagem."); 
      setLoading(false);
      setError("Usuário não autenticado.");
    }

  }, []); // Array de dependências vazio continua correto

  // --- Render JSX (sem alterações) ---
  return (
    <div className="processos-list-page"> 
      <div className="page-header">
        <h2 className="page-title">Meus Processos</h2>
        <Link to="/processos/novo" className="button-primary-alt">
          <PlusIcon /> Adicionar Novo Processo
        </Link>
      </div>

      {loading && <p className="loading-message">Carregando processos...</p>}
      {error && <p className="error-message" style={{whiteSpace: 'pre-wrap'}}>{error}</p>} 
      {!loading && !error && processos.length === 0 && ( 
        <p className="empty-state">Nenhum processo encontrado.</p> 
      )}
      {!loading && !error && processos.length > 0 && (
        <table className="processos-table"> 
          <thead>
            <tr>
              <th>Referência / Nº Oficial</th> 
              <th>Cliente Vinculado</th> 
              <th>Tipo/Área</th>
              <th>Status</th>
              <th>Data Abertura</th> 
              <th>Ações</th>
            </tr>
          </thead>
          <tbody> 
            {processos.map(processo => (
              <tr key={processo.id}>
                <td>
                    {processo.numeroInterno && <div>Int: {processo.numeroInterno}</div>}
                    {processo.numeroOficial && <div>Oficial: {processo.numeroOficial}</div>}
                    {!processo.numeroInterno && !processo.numeroOficial && 'N/A'}
                </td>
                <td>
                    {processo.clienteId && processo.clienteNome ? ( <Link to={`/clientes/${processo.clienteId}`} title="Ver detalhes">{processo.clienteNome}</Link> ) : ( processo.clienteNome || 'N/A' )}
                </td>
                <td>{processo.tipo || 'N/A'}</td>
                <td><span className={`status-badge status-${(processo.status || 'desconhecido').toLowerCase().replace(/\s+/g, '-')}`}>{processo.status || 'Desconhecido'}</span></td>
                <td>{formatDate(processo.dataAbertura)}</td> 
                <td><Link to={`/processos/${processo.id}`} className="action-link">Detalhes</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ProcessosListPage;