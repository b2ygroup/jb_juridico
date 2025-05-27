import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate pode ser usado para outras ações
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import './ProcessosListPage.css'; // Reutilizar estilos de lista

const InboxIcon = () => <span style={{fontSize: '1.2em', marginRight: '0.5em'}}>&#128230;</span>;
// FilterIcon removido se não usado diretamente

const formatDateList = (timestamp) => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return '-';
};

const statusOcorrenciaOptions = ["Todos", "Enviada", "Em Análise", "Contato Realizado", "Convertida em Processo", "Recusada", "Cancelada pelo Cliente"];

function OcorrenciasListPage() {
  const navigate = useNavigate(); // Para futuras ações, se necessário
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("Todos"); // Mostrar todos por padrão na lista completa
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const currentUser = auth.currentUser;

    if (currentUser) { 
      let q;
      const ocorrenciasRef = collection(db, "ocorrencias");
      if (filtroStatus && filtroStatus !== "Todos") {
        q = query(ocorrenciasRef, where("statusOcorrencia", "==", filtroStatus), orderBy("criadoEm", "desc"));
      } else {
        q = query(ocorrenciasRef, orderBy("criadoEm", "desc"));
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let itensData = [];
        querySnapshot.forEach((doc) => {
          itensData.push({ id: doc.id, ...doc.data() });
        });
        
        if (searchTerm) {
            itensData = itensData.filter(item => 
                (item.titulo && item.titulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.clienteNome && item.clienteNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.id && item.id.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        setOcorrencias(itensData);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao buscar ocorrências: ", err);
        setError("Não foi possível carregar as ocorrências.");
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setOcorrencias([]);
      setLoading(false);
    }
  }, [filtroStatus, searchTerm]);

  return (
    <div className="processos-list-page ocorrencias-list-page">
      <div className="page-header">
        <h2 className="page-title"><InboxIcon />Gerenciamento de Ocorrências</h2>
      </div>

      <div className="filtros-container" style={{marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
        <div className="form-group" style={{flex: '1 1 200px'}}>
          <label htmlFor="filtroStatusOcorrencia">Filtrar por Status:</label>
          <select id="filtroStatusOcorrencia" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            {statusOcorrenciaOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{flex: '2 1 300px'}}>
            <label htmlFor="searchTermOcorrencia">Buscar (Título, Cliente, Protocolo):</label>
            <input 
                type="text" 
                id="searchTermOcorrencia"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {loading && <p className="loading-message">Carregando ocorrências...</p>}
      {error && <p className="form-feedback error">{error}</p>}
      {!loading && !error && ocorrencias.length === 0 && (
        <p className="empty-message">Nenhuma ocorrência encontrada para os filtros selecionados.</p>
      )}
      {!loading && !error && ocorrencias.length > 0 && (
        <div className="list-table-container">
          <table className="processos-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Cliente</th>
                <th>Assunto/Título</th>
                <th>Tipo de Caso</th>
                <th>Data Envio</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ocorrencias.map((item) => (
                <tr key={item.id}>
                  <td>{item.id.substring(0,8).toUpperCase()}</td>
                  <td>{item.clienteNome || item.clienteEmail || 'N/A'}</td>
                  <td title={item.titulo}>{item.titulo.length > 30 ? item.titulo.substring(0,27) + "..." : item.titulo}</td>
                  <td>{item.tipoCaso}</td>
                  <td>{formatDateList(item.criadoEm)}</td>
                  <td>
                    <span className={`status-badge status-${(item.statusOcorrencia || 'desconhecido').toLowerCase().replace(/\s+/g, '-')}`}>
                      {item.statusOcorrencia}
                    </span>
                  </td>
                  <td>
                    <Link to={`/ocorrencias/${item.id}`} className="action-button view">
                      Ver Detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default OcorrenciasListPage;