import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, deleteDoc } from "firebase/firestore"; 
import { db, auth } from './firebaseConfig'; 
import './ProcessosListPage.css'; // Reutilizando CSS

const PlusIcon = () => <span style={{fontSize: '1em', marginRight: '0.3em'}}>&#43;</span>;
const AgendaIcon = () => <span style={{fontSize: '1em', marginRight: '0.3em'}}>&#128197;</span>; 
const DeleteIcon = () => <span style={{ marginRight: '0.5em' }}>&#128465;</span>; 
const EditIcon = () => <>&#9998;</>; 

const formatDate = (timestamp) => {
  let dateObject = null;
  if (timestamp instanceof Timestamp) { dateObject = timestamp.toDate(); } 
  else if (timestamp instanceof Date) { dateObject = timestamp; }
  if (dateObject) {
    return dateObject.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); 
  }
  return '-'; 
};

function AgendaListPage() {
  const navigate = useNavigate(); 
  const [agendaItens, setAgendaItens] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [deletingId, setDeletingId] = useState(null); 

  useEffect(() => {
    setLoading(true); setError(null); setAgendaItens([]); 
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        console.log("AgendaListPage: User ID:", user.uid); 
        const q = query( collection(db, "agendaItens"), where("userId", "==", user.uid), orderBy("dataHoraInicio", "asc") );
        console.log("AgendaListPage: Query criada.");
        const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
          console.log("AgendaListPage: Snapshot recebido. Vazio?", querySnapshot.empty);
          const itensData = [];
          querySnapshot.forEach((doc) => { itensData.push({ id: doc.id, ...doc.data() }); });
          setAgendaItens(itensData); setLoading(false); 
        }, (err) => {
          console.error("AgendaListPage: Erro no listener:", err); 
          if (err.code === 'failed-precondition') { setError("Erro: Índice necessário não encontrado..."); } 
          else { setError("Não foi possível carregar a agenda."); }
          setLoading(false);
        });
        return () => { console.log("AgendaListPage: Limpando listener snapshot."); unsubscribeSnapshot(); };
      } else {
        console.warn("AgendaListPage: Nenhum usuário logado."); 
        setLoading(false); setError("Autenticação necessária."); setAgendaItens([]);
      }
    });
    return () => { console.log("AgendaListPage: Limpando listener auth."); unsubscribeAuth(); };
  }, []); 

  const handleDeleteItem = async (itemId, itemTitulo) => {
    const confirmDelete = window.confirm(`Excluir "${itemTitulo}"?`);
    if (confirmDelete) {
        setDeletingId(itemId); setError(null);
        try {
            await deleteDoc(doc(db, "agendaItens", itemId));
            console.log("Item excluído!");
        } catch (err) { console.error("Erro:", err); setError("Erro ao excluir."); } 
        finally { setDeletingId(null); }
    }
  };

  return (
    <div className="processos-list-page"> 
      <div className="page-header">
        <h2 className="page-title"><AgendaIcon /> Minha Agenda</h2> 
        <Link to="/agenda/novo" className="button-primary-alt">
          <PlusIcon /> Adicionar Item
        </Link>
      </div>

      {loading && <p className="loading-message">Carregando agenda...</p>}
      {error && <p className="error-message" style={{whiteSpace: 'pre-wrap'}}>{error}</p>} 
      {!loading && !error && agendaItens.length === 0 && ( <p className="empty-state">Nenhum item na agenda.</p> )}

      {!loading && !error && agendaItens.length > 0 && (
        <table className="processos-table agenda-table"> 
          {/* Cabeçalho da Tabela sem espaços extras */}
          <thead><tr> 
            <th>Data/Hora Início</th>
            <th>Título</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Vinculado a</th> 
            <th>Ações</th>
          </tr></thead>
          {/* Corpo da Tabela */}
          <tbody> 
            {agendaItens.map(item => (
              <tr key={item.id}>
                <td>{formatDate(item.dataHoraInicio)}</td>
                <td>{item.titulo || 'N/A'}</td>
                <td>{item.tipo || 'N/A'}</td>
                <td>{item.status || 'N/A'}</td>
                 <td>
                    {item.processoId && item.processoDisplay && <Link to={`/processos/${item.processoId}`} className='link-vinculo'>P: {item.processoDisplay}</Link> }
                    {item.clienteId && item.clienteNome && <Link to={`/clientes/${item.clienteId}`} className='link-vinculo'>C: {item.clienteNome}</Link> }
                    {!item.processoId && !item.clienteId && '-'} 
                 </td>
                <td>
                  <Link to={`/agenda/${item.id}/editar`} className="action-link" style={{marginRight:'0.5rem'}} title="Editar Item"><EditIcon /></Link>
                  <button className="action-link danger" style={{border:'none', background:'none', cursor:'pointer'}} onClick={() => handleDeleteItem(item.id, item.titulo)} disabled={deletingId === item.id} title="Excluir Item">{deletingId === item.id ? '...' : <DeleteIcon />}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AgendaListPage;