import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, Timestamp, deleteDoc } from "firebase/firestore"; // deleteDoc está aqui
import { db } from './firebaseConfig'; 
import './ClienteDetalhePage.css'; 

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const EditIcon = () => <span style={{ marginRight: '0.5em' }}>&#9998;</span>; 
const DeleteIcon = () => <span style={{ marginRight: '0.5em' }}>&#128465;</span>; 

const formatDate = (timestamp) => {
  let dateObject = null;
  if (timestamp instanceof Timestamp) { dateObject = timestamp.toDate(); } 
  else if (timestamp instanceof Date) { dateObject = timestamp; }
  if (dateObject) {
    const dateString = dateObject.toLocaleDateString('pt-BR', { dateStyle: 'short' }); 
    const timeString = dateObject.toLocaleTimeString('pt-BR', { timeStyle: 'short' }); 
    return `${dateString} ${timeString}`;
  }
  return '-'; 
};

function ClienteDetalhePage() {
  const { idCliente } = useParams(); 
  const navigate = useNavigate(); 

  const [cliente, setCliente] = useState(null); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [isDeleting, setIsDeleting] = useState(false); 

  // useEffect para buscar dados (sem alterações)
  useEffect(() => {
    let isMounted = true; 
    const fetchCliente = async () => {
      if (!idCliente) { if (isMounted) { setError("ID inválido."); setLoading(false); } return; }
      if (isMounted) { setLoading(true); setError(null); setCliente(null); } 
      try {
        const docRef = doc(db, "clientes", idCliente); 
        const docSnap = await getDoc(docRef);
        if (!isMounted) return; 
        if (docSnap.exists()) { setCliente({ id: docSnap.id, ...docSnap.data() }); } 
        else { setError("Cliente não encontrado."); }
      } catch (err) { console.error("Erro:", err); if (isMounted) { setError("Erro ao carregar detalhes."); } } 
      finally { if (isMounted) { setLoading(false); } }
    };
    fetchCliente(); 
    return () => { isMounted = false; }; 
  }, [idCliente]); 

  // --- Função handleDelete COM LÓGICA ATIVA ---
  const handleDelete = async () => { 
      if (!cliente) return; 
      
      // Confirmação com o usuário
      const confirmDelete = window.confirm(`Tem certeza que deseja excluir o cliente "${cliente.nomeCompleto}"? Esta ação não pode ser desfeita.`);
      
      if (confirmDelete) {
          setIsDeleting(true); // Mostra feedback visual (botão desabilitado, etc.)
          setError(null); // Limpa erros anteriores
          const docRef = doc(db, "clientes", idCliente); // Referência ao documento a ser deletado
          try {
              await deleteDoc(docRef); // Deleta o documento no Firestore
              console.log("Cliente excluído com sucesso!");
              navigate('/clientes'); // Redireciona para a lista após sucesso
          } catch (err) {
              console.error("Erro ao excluir cliente: ", err);
              setError("Não foi possível excluir o cliente. Tente novamente."); // Mostra erro
              setIsDeleting(false); // Reabilita o botão se der erro
          }
          // Não precisa setar isDeleting como false no SUCESSO, pois navega para outra página
      }
  };
  // --- FIM FUNÇÃO EXCLUIR ---


  // --- Renderização ---
  if (loading) { return (<div className="cliente-detalhe-page"><p className="loading-message">Carregando...</p></div>); }
  // Mostra erro de carregamento OU erro de exclusão (se isDeleting for true)
  if (error) { return ( 
        <div className="cliente-detalhe-page">
             <div className="page-header">
                 <h2 className="page-title">Erro</h2> 
                 <button onClick={() => navigate('/clientes')} className="button-secondary-alt"><BackArrowIcon /> Voltar para Lista</button>
             </div>
            <p className="error-message">{error}</p>
        </div> ); }
  // Se não está carregando, não tem erro E cliente não foi encontrado
  if (!cliente && !loading) { return ( 
        <div className="cliente-detalhe-page">
             <div className="page-header">
                 <h2 className="page-title">Não Encontrado</h2> 
                 <button onClick={() => navigate('/clientes')} className="button-secondary-alt"><BackArrowIcon /> Voltar para Lista</button>
             </div>
            <p className="not-found-message">Cliente não encontrado.</p>
        </div> ); }

  // Renderização Principal (se cliente existe)
  return (
    <div className="cliente-detalhe-page">
      <div className="page-header">
        <h2 className="page-title">Detalhes: {cliente?.nomeCompleto || 'Sem Nome'}</h2> 
        {/* Usando navigate(-1) pode ser mais intuitivo para voltar da onde veio */}
        <button type="button" onClick={() => navigate(-1)} className="button-secondary-alt"><BackArrowIcon /> Voltar</button>
      </div>

       {/* Mostra erro específico de exclusão se houver E isDeleting for true */}
       {error && isDeleting && <p className="error-message">{error}</p>}

      {/* Só renderiza o conteúdo se o cliente não for null */}
      {cliente && (
        <>
            {/* ... Cards de Detalhes ... */}
            <div className="detalhe-card"><h3>Dados</h3><div className="detalhe-grid">
                <div className="detalhe-item"><strong>Nome/Razão:</strong> {cliente.nomeCompleto}</div>
                <div className="detalhe-item"><strong>Tipo:</strong> {cliente.tipoPessoa}</div>
                {cliente.cpfCnpj && <div className="detalhe-item"><strong>{cliente.tipoPessoa === 'Pessoa Física' ? 'CPF:' : 'CNPJ:'}</strong> {cliente.cpfCnpj}</div>}
                {cliente.emailPrincipal && <div className="detalhe-item"><strong>E-mail:</strong> {cliente.emailPrincipal}</div>}
                {cliente.telefonePrincipal && <div className="detalhe-item"><strong>Telefone:</strong> {cliente.telefonePrincipal}</div>}
            </div></div>
            { (cliente.enderecoCEP || cliente.enderecoLogradouro) && (<div className="detalhe-card"><h3>Endereço</h3><div className="detalhe-grid">
                 {cliente.enderecoLogradouro && <div className="detalhe-item full-width"><strong>Logradouro:</strong> {`${cliente.enderecoLogradouro}${cliente.enderecoNumero ? ', ' + cliente.enderecoNumero : ''}${cliente.enderecoComplemento ? ' - ' + cliente.enderecoComplemento : ''}`}</div>}
                 {cliente.enderecoBairro && <div className="detalhe-item"><strong>Bairro:</strong> {cliente.enderecoBairro}</div>}
                 {cliente.enderecoCidade && <div className="detalhe-item"><strong>Cidade:</strong> {cliente.enderecoCidade}</div>}
                 {cliente.enderecoUF && <div className="detalhe-item"><strong>UF:</strong> {cliente.enderecoUF}</div>}
                 {cliente.enderecoCEP && <div className="detalhe-item"><strong>CEP:</strong> {cliente.enderecoCEP}</div>}
            </div></div>)}
            {cliente.observacoes && ( <div className="detalhe-card"><h3>Observações</h3><p style={{whiteSpace: 'pre-wrap'}}>{cliente.observacoes}</p></div> )}
            <div className="detalhe-card system-info-card"><div className="detalhe-grid">
                 {cliente.criadoEm && <div className="detalhe-item"><strong>Desde:</strong> {formatDate(cliente.criadoEm)}</div>} 
                 {cliente.atualizadoEm && <div className="detalhe-item"><strong>Atualizado:</strong> {formatDate(cliente.atualizadoEm)}</div>}
            </div></div>

            {/* Botões de Ação */}
            <div style={{marginTop: '2rem', textAlign: 'right'}}>
                <Link to={`/clientes/${cliente.id}/editar`} className="button-primary-alt" style={{marginRight: '1rem'}}>
                    <EditIcon /> Editar Cliente 
                </Link> 
                <button 
                    type="button" 
                    onClick={handleDelete} 
                    className="button-danger-alt" // Estilo de perigo
                    style={{marginRight: '1rem'}}
                    disabled={isDeleting} // Desabilita durante a exclusão
                >
                    <DeleteIcon /> {isDeleting ? 'Excluindo...' : 'Excluir Cliente'}
                </button>
                {/* Botão Voltar para Lista */}
                <button type="button" onClick={() => navigate('/clientes')} className="button-secondary-alt"> 
                    Voltar para Lista
                </button>
            </div>
        </>
      )}
    </div>
  );
}

export default ClienteDetalhePage;