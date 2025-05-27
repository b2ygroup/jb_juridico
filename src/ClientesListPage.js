import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore"; // Mantém Timestamp se precisar lidar com datas do snapshot
import { db, auth } from './firebaseConfig'; 
import './ProcessosListPage.css'; // Reutilizando CSS

const PlusIcon = () => <span className="icon-placeholder" style={{fontSize: '1em', marginRight: '0.3em'}}>&#43;</span>;
const UserIcon = () => <span className="icon-placeholder" style={{fontSize: '1em', marginRight: '0.3em'}}>&#128100;</span>;

// REMOVIDA a função formatDate que não era usada aqui

function ClientesListPage() {
  const [clientes, setClientes] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 

  useEffect(() => {
    setLoading(true);
    setError(null);
    const currentUser = auth.currentUser;

    if (currentUser) {
      const q = query(
        collection(db, "clientes"), 
        where("userId", "==", currentUser.uid), 
        orderBy("nomeCompleto", "asc") 
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const clientesData = [];
        querySnapshot.forEach((doc) => {
          clientesData.push({ id: doc.id, ...doc.data() });
        });
        setClientes(clientesData); 
        setLoading(false); 
      }, (err) => {
        console.error("Erro ao buscar clientes: ", err);
        setError("Não foi possível carregar os clientes.");
        setLoading(false);
      });

      return () => unsubscribe();

    } else {
      console.log("Nenhum usuário logado para buscar clientes.");
      setClientes([]); setLoading(false);
    }

  }, []); 

  return (
    <div className="processos-list-page"> 
      <div className="page-header">
        <h2 className="page-title"><UserIcon /> Meus Clientes</h2> 
        <Link to="/clientes/novo" className="button-primary-alt">
          <PlusIcon /> Adicionar Novo Cliente
        </Link>
      </div>

      {loading && <p className="loading-message">Carregando clientes...</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && clientes.length === 0 && ( 
        <p className="empty-state">Nenhum cliente encontrado. Adicione um novo cliente!</p> 
      )}

      {!loading && !error && clientes.length > 0 && (
        <table className="processos-table"> 
          <thead>
            <tr>
              <th>Nome / Razão Social</th>
              <th>CPF / CNPJ</th>
              <th>Contato Principal</th>
              <th>Cidade / UF</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody> 
            {clientes.map(cliente => (
              <tr key={cliente.id}>
                <td>{cliente.nomeCompleto || 'N/A'}</td>
                <td>{cliente.cpfCnpj || 'N/A'}</td>
                <td>
                    {cliente.emailPrincipal && <div>{cliente.emailPrincipal}</div>}
                    {cliente.telefonePrincipal && <div>{cliente.telefonePrincipal}</div>}
                    {!cliente.emailPrincipal && !cliente.telefonePrincipal && '-'}
                </td>
                 <td>
                    {cliente.enderecoCidade && cliente.enderecoUF ? `${cliente.enderecoCidade} / ${cliente.enderecoUF}` : 'N/A'}
                 </td>
                <td>
                  <Link to={`/clientes/${cliente.id}`} className="action-link">Detalhes</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ClientesListPage;