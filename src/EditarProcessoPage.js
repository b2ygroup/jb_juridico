import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Link está importado
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import { IMaskInput } from 'react-imask';
import './NovoProcessoPage.css'; // Reutilizando CSS

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const EditIcon = () => <span style={{ marginRight: '0.5em' }}>&#9998;</span>;

const tiposDeProcesso = [ "Cível", "Trabalhista", "Criminal", "Família", "Empresarial", "Tributário", "Previdenciário", "Contratual", "Administrativo", "Consultivo", "Outro" ];
const statusDeProcesso = [ "Novo", "Em Andamento", "Suspenso", "Aguardando Documentos", "Pendente Análise", "Concluído", "Arquivado" ];

const formatTimestampForInput = (timestamp) => {
  if (timestamp instanceof Timestamp) { return timestamp.toDate().toISOString().split('T')[0]; }
  else if (timestamp instanceof Date) { return timestamp.toISOString().split('T')[0]; }
  return '';
};

function EditarProcessoPage() {
  const { idProcesso } = useParams();
  const navigate = useNavigate();
  // --- Estados ---
  const [numeroInterno, setNumeroInterno] = useState('');
  const [numeroOficial, setNumeroOficial] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState('');
  const [parteContraria, setParteContraria] = useState('');
  const [tipo, setTipo] = useState(tiposDeProcesso[0]);
  const [status, setStatus] = useState(statusDeProcesso[0]);
  const [dataAbertura, setDataAbertura] = useState('');
  const [valorCausa, setValorCausa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [listaClientes, setListaClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  // --- Fim Estados ---

  const currencyMaskDefinition = { /* ... */ };
  useEffect(() => { /* ... buscar clientes (igual NovoProcessoPage) ... */ }, []);
  useEffect(() => { /* ... buscar processo (igual antes) ... */ }, [idProcesso]);
  const validateForm = () => { /* ... (igual antes) ... */ return true;};
  const handleSubmit = async (event) => { /* ... (lógica de submit como antes) ... */ };

  if (loadingData || loadingClientes) { return (<div className="novo-processo-page"><p className="loading-message">Carregando...</p></div>); }
  if (notFound || (submitError && !isSubmitting && !submitSuccess)) { /* ... JSX erro ... */ }

  return (
    <div className="novo-processo-page">
        <div className="page-header">
            <h2 className="page-title">Editar Processo</h2>
            <button type="button" onClick={() => navigate(`/processos/${idProcesso}`)} className="button-secondary-alt" disabled={isSubmitting}>
                <BackArrowIcon /> Cancelar Edição
            </button>
        </div>
        <form onSubmit={handleSubmit} className="processo-form-card">
            <div className="feedback-container">
                {submitError ? <p className="form-feedback error">{submitError}</p> : null}
                {submitSuccess ? <p className="form-feedback success">{submitSuccess}</p> : null}
            </div>
            <div className="form-grid">
                {/* ... campos numeroInterno, numeroOficial ... */}
                <div className="form-group full-width">
                    <label htmlFor="clienteEdit">Cliente:</label>
                    <select id="clienteEdit" value={clienteSelecionadoId} onChange={(e) => setClienteSelecionadoId(e.target.value)} disabled={isSubmitting || loadingClientes}>
                        {listaClientes.map(cliente => (<option key={cliente.id || 'default-cliente-opt-edit'} value={cliente.id}>{cliente.nomeCompleto || cliente.display}</option>))}
                    </select>
                    {/* --- LINK CORRIGIDO AQUI --- */}
                    {!loadingClientes && (
                        <Link to="/clientes/novo" className="link-add-new">
                            (Adicionar Novo Cliente)
                        </Link>
                    )}
                     {!loadingClientes && listaClientes.length <=1 && (
                         <p className='info-text'>Nenhum cliente. <Link to="/clientes/novo">Cadastre um</Link>.</p>
                     )}
                </div>
                {/* ... restante dos campos do formulário ... */}
            </div>
            <div className="form-actions">
                 <button type="submit" className="button-primary-alt" disabled={isSubmitting || loadingClientes}> Salvar Alterações </button>
                 <button type="button" onClick={() => navigate(`/processos/${idProcesso}`)} className="button-secondary-alt" disabled={isSubmitting}> Cancelar </button>
            </div>
        </form>
    </div>
  );
}
export default EditarProcessoPage;