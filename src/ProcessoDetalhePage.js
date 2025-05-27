import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, Timestamp, collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore"; // Removido deleteDoc
import { db, auth } from './firebaseConfig';
import { getFunctions, httpsCallable, FunctionsError, connectFunctionsEmulator } from "firebase/functions";
import './ProcessoDetalhePage.css';

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const EditIcon = () => <span style={{ marginRight: '0.5em' }}>&#9998;</span>;
const AddIcon = () => <span style={{ marginRight: '0.5em' }}>&#43;</span>;
const SparkleIcon = () => <span style={{ marginRight: '0.5em' }}>✨</span>;

const formatDate = (timestamp) => {
  let dateObject = null;
  if (timestamp instanceof Timestamp) { dateObject = timestamp.toDate(); }
  else if (timestamp instanceof Date) { dateObject = timestamp; }
  if (dateObject) { return dateObject.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  return '-';
};

const functionsInstance = getFunctions();
if (process.env.NODE_ENV === 'development') {
  try {
    connectFunctionsEmulator(functionsInstance, "localhost", 5001);
    console.log("ProcessoDetalhePage: Funções conectadas ao emulador.");
  } catch (e) {
    console.warn("ProcessoDetalhePage: Falha ao conectar ao emulador.", e);
  }
}

function ProcessoDetalhePage() {
  const { idProcesso } = useParams();
  const navigate = useNavigate();

  const [processo, setProcesso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [andamentos, setAndamentos] = useState([]);
  const [loadingAndamentos, setLoadingAndamentos] = useState(true);
  const [errorAndamentos, setErrorAndamentos] = useState(null);
  const [novoAndamentoDesc, setNovoAndamentoDesc] = useState("");
  const [isAddingAndamento, setIsAddingAndamento] = useState(false);

  // Estados para Resumo IA (Observações do Processo)
  const [resumoIAObservacoes, setResumoIAObservacoes] = useState("");
  const [loadingResumoObs, setLoadingResumoObs] = useState(false); // << Nome correto
  const [erroResumoObs, setErroResumoObs] = useState(null);     // << Nome correto

  // Estados para Resumos de Andamentos Individuais
  const [resumosAndamentos, setResumosAndamentos] = useState({});
  const [loadingAndamentoId, setLoadingAndamentoId] = useState(null);

  // Efeito para buscar dados do processo
  useEffect(() => {
    let isMounted = true;
    const fetchProcesso = async () => {
      if (!idProcesso) { if (isMounted) { setError("ID do processo inválido."); setLoading(false); } return; }
      if (isMounted) { setLoading(true); setError(null); setProcesso(null); }
      try {
        const docRef = doc(db, "processos", idProcesso);
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        if (docSnap.exists()) { setProcesso({ id: docSnap.id, ...docSnap.data() }); }
        else { setError("Processo não encontrado."); }
      } catch (err) { console.error("Erro ao buscar processo:", err); if (isMounted) { setError("Erro ao carregar detalhes do processo."); } }
      finally { if (isMounted) { setLoading(false); } }
    };
    fetchProcesso();
    return () => { isMounted = false; };
  }, [idProcesso]);

  // Efeito para buscar andamentos
  useEffect(() => {
    if (!idProcesso) return;
    let isMounted = true;
    setLoadingAndamentos(true); setErrorAndamentos(null); setAndamentos([]);
    const andamentosCollectionRef = collection(db, "processos", idProcesso, "andamentos");
    const q = query(andamentosCollectionRef, orderBy("criadoEm", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!isMounted) return;
      const andamentosData = [];
      querySnapshot.forEach((doc) => { andamentosData.push({ id: doc.id, ...doc.data() }); });
      setAndamentos(andamentosData); setLoadingAndamentos(false);
    }, (err) => {
      if (!isMounted) return;
      console.error("Erro ao buscar andamentos:", err); setErrorAndamentos("Erro ao carregar andamentos."); setLoadingAndamentos(false);
    });
    return () => { isMounted = false; unsubscribe(); };
  }, [idProcesso]);

  // Função para adicionar Andamento
  const handleAddAndamento = async (event) => {
    event.preventDefault();
    if (!novoAndamentoDesc.trim()) { alert("Digite a descrição do andamento."); return; }
    setIsAddingAndamento(true);
    const currentUser = auth.currentUser;
    const novoAndamento = {
      descricao: novoAndamentoDesc.trim(), data: Timestamp.now(),
      userId: currentUser ? currentUser.uid : null, userName: currentUser ? currentUser.email : null,
      criadoEm: Timestamp.now()
    };
    try {
      await addDoc(collection(db, "processos", idProcesso, "andamentos"), novoAndamento);
      setNovoAndamentoDesc("");
    } catch (err) { console.error("Erro ao adicionar andamento:", err); alert("Erro ao salvar andamento."); }
    finally { setIsAddingAndamento(false); }
  };

  // Função para Gerar Resumo (Genérica)
  const gerarResumoComIA = async (textoParaResumir, tipoResumo, itemId = null) => {
    if (!textoParaResumir || textoParaResumir.trim() === "") {
      if (tipoResumo === "observacoes") setErroResumoObs("Não há texto para resumir.");
      if (tipoResumo === "andamento" && itemId) {
        setResumosAndamentos(prev => ({...prev, [itemId]: {...(prev[itemId] || {}), error: "Não há texto."}}));
      }
      return;
    }

    if (tipoResumo === "observacoes") {
      setLoadingResumoObs(true); setErroResumoObs(null); setResumoIAObservacoes("");
    } else if (tipoResumo === "andamento" && itemId) {
      setLoadingAndamentoId(itemId);
      setResumosAndamentos(prev => ({ ...prev, [itemId]: { text: prev[itemId]?.text || '', error: null, loading: true } }));
    }

    try {
      const summarizeTextFunc = httpsCallable(functionsInstance, 'summarizeText');
      const result = await summarizeTextFunc({ text: textoParaResumir });
      const summaryData = result.data;
      const summary = (summaryData && typeof summaryData === 'object' && typeof summaryData.summary === 'string')
                      ? summaryData.summary
                      : null;
      if (summary) {
        if (tipoResumo === "observacoes") setResumoIAObservacoes(summary);
        if (tipoResumo === "andamento" && itemId) {
           setResumosAndamentos(prev => ({...prev, [itemId]: {text: summary, error: null, loading: false }}));
        }
      } else { throw new Error("Resposta da IA não continha um resumo válido."); }
    } catch (err) {
      console.error("Erro ao chamar Cloud Function para resumo:", err);
      let errorMessage = "Erro ao gerar resumo.";
      if (err instanceof FunctionsError) { errorMessage = `Erro (${err.code}): ${err.message}`; }
      else if (err instanceof Error) { errorMessage = err.message; }
      if (tipoResumo === "observacoes") setErroResumoObs(errorMessage);
      if (tipoResumo === "andamento" && itemId) {
         setResumosAndamentos(prev => ({...prev, [itemId]: {text: '', error: errorMessage, loading: false }}));
      }
    } finally {
      if (tipoResumo === "observacoes") setLoadingResumoObs(false);
      if (tipoResumo === "andamento" && itemId) {
          setResumosAndamentos(prev => ({ ...prev, [itemId]: { ...prev[itemId], loading: false } }));
          setLoadingAndamentoId(null);
      }
    }
  };

  // --- Renderização ---
  if (loading) { return (<div className="processo-detalhe-page"><p className="loading-message">Carregando dados do processo...</p></div>); }
  if (error) { return ( <div className="processo-detalhe-page"><div className="page-header"><h2 className="page-title">Erro</h2><button onClick={() => navigate('/processos')} className="button-secondary-alt"><BackArrowIcon /> Voltar</button></div><p className="error-message">{error}</p></div> ); }
  if (!processo) { return ( <div className="processo-detalhe-page"><div className="page-header"><h2 className="page-title">Não Encontrado</h2><button onClick={() => navigate('/processos')} className="button-secondary-alt"><BackArrowIcon /> Voltar</button></div><p className="not-found-message">Processo não encontrado.</p></div> ); }

  return (
    <div className="processo-detalhe-page">
      <div className="page-header">
         <h2 className="page-title">Detalhes: {processo.numeroOficial || processo.numeroInterno || 'Processo'}</h2>
         <button type="button" onClick={() => navigate(-1)} className="button-secondary-alt"><BackArrowIcon /> Voltar</button>
      </div>

      <div className="detalhe-card"><h3>Dados do Processo</h3><div className="detalhe-grid">
        {processo.numeroInterno && <div className="detalhe-item"><strong>Número Interno:</strong> {processo.numeroInterno}</div>}
        {processo.numeroOficial && <div className="detalhe-item"><strong>Número Oficial:</strong> {processo.numeroOficial}</div>}
        {processo.clienteNome && <div className="detalhe-item"><strong>Cliente:</strong> {processo.clienteId ? <Link to={`/clientes/${processo.clienteId}`}>{processo.clienteNome}</Link> : processo.clienteNome}</div>}
        {processo.parteContraria && <div className="detalhe-item"><strong>Parte Contrária:</strong> {processo.parteContraria}</div>}
        {processo.tipo && <div className="detalhe-item"><strong>Tipo/Área:</strong> {processo.tipo}</div>}
        {processo.status && <div className="detalhe-item"><strong>Status:</strong> <span className={`status-badge status-${(processo.status).toLowerCase().replace(/\s+/g, '-')}`}>{processo.status}</span></div>}
        {processo.dataAbertura && <div className="detalhe-item"><strong>Data Abertura:</strong> {formatDate(processo.dataAbertura)}</div>}
        <div className="detalhe-item"><strong>Valor da Causa:</strong> {processo.valorCausa || (processo.valorCausaNumerico ? processo.valorCausaNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A')}</div>
      </div></div>

      <div className="detalhe-card">
        <div className="card-header-with-action">
          <h3>Observações</h3>
          {processo.observacoes && processo.observacoes.trim() !== "" ? (
            <button 
                onClick={() => gerarResumoComIA(processo.observacoes, "observacoes")}
                className="button-secondary-alt small-button"
                // --- USO CORRETO DOS ESTADOS DE OBSERVAÇÕES ---
                disabled={loadingResumoObs || !processo.observacoes.trim()} 
                title="Gerar resumo IA"
            >
                <SparkleIcon /> {loadingResumoObs ? 'Gerando...' : 'Resumir Observações'}
            </button>
          ) : (
            <button className="button-secondary-alt small-button" disabled={true} title="Adicione observações">
                 <SparkleIcon /> Gerar Resumo IA
            </button>
          )}
        </div>
        <p style={{whiteSpace: 'pre-wrap'}}>{processo.observacoes || "Nenhuma observação registrada."}</p>
        <div className="resumo-ia-container">
          {/* --- USO CORRETO DOS ESTADOS DE OBSERVAÇÕES --- */}
          {loadingResumoObs && <p className='loading-message small-loading'>Processando resumo das observações...</p>}
          {erroResumoObs && <p className='error-message small-error'>{erroResumoObs}</p>}
          {resumoIAObservacoes && (
              <div className="resumo-ia-content"><h4>Resumo IA (Observações):</h4><p>{resumoIAObservacoes}</p></div>
          )}
        </div>
      </div>

      <div className="detalhe-card">
         <h3>Andamentos / Histórico</h3>
         <form onSubmit={handleAddAndamento} className="add-andamento-form">
            <div className="form-group">
                <label htmlFor="novoAndamento">Adicionar Andamento:</label>
                <textarea id="novoAndamento" rows="3" value={novoAndamentoDesc} onChange={(e) => setNovoAndamentoDesc(e.target.value)} placeholder="Descreva o andamento..." disabled={isAddingAndamento} required />
            </div>
            <button type="submit" className="button-primary-alt small-button" disabled={isAddingAndamento}> <AddIcon/> {isAddingAndamento ? 'Adicionando...' : 'Adicionar'} </button>
        </form>
         <div className="andamentos-list-container">
            {loadingAndamentos && <p className="loading-message small-loading">Carregando andamentos...</p>}
            {errorAndamentos && <p className="error-message small-error">{errorAndamentos}</p>}
            {!loadingAndamentos && !errorAndamentos && andamentos.length === 0 && (<p className="empty-state small-empty">Nenhum andamento.</p>)}
            {!loadingAndamentos && !errorAndamentos && andamentos.length > 0 && (
                <ul className="andamentos-lista">
                    {andamentos.map(andamento => (
                    <li key={andamento.id}>
                        <div className="andamento-header">
                            <span className="andamento-data">{formatDate(andamento.criadoEm || andamento.data)}</span>
                            {andamento.descricao && andamento.descricao.trim() !== "" && (
                                <button
                                    onClick={() => gerarResumoComIA(andamento.descricao, "andamento", andamento.id)}
                                    className="button-ia-andamento"
                                    disabled={loadingAndamentoId === andamento.id}
                                    title="Resumir este andamento com IA"
                                >
                                    <SparkleIcon /> {(loadingAndamentoId === andamento.id) ? '...' : 'Resumir'}
                                </button>
                            )}
                        </div>
                        <p className="andamento-desc">{andamento.descricao}</p>
                        {loadingAndamentoId === andamento.id && <p className='loading-message small-loading'>Resumindo andamento...</p>}
                        {resumosAndamentos[andamento.id]?.error && <p className='error-message small-error'>{resumosAndamentos[andamento.id].error}</p>}
                        {resumosAndamentos[andamento.id]?.text && (
                             <div className="resumo-ia-content sub-resumo">
                                <h4>Resumo IA:</h4>
                                <p>{resumosAndamentos[andamento.id].text}</p>
                            </div>
                        )}
                    </li>
                    ))}
                </ul>
            )}
        </div>
      </div>

       <div style={{marginTop: '2rem', textAlign: 'right'}}>
           <Link to={`/processos/${processo.id}/editar`} className="button-primary-alt" style={{marginRight: '1rem'}}><EditIcon /> Editar Processo</Link>
           <button type="button" onClick={() => navigate('/processos')} className="button-secondary-alt">Voltar para Lista</button>
       </div>
    </div>
  );
}
export default ProcessoDetalhePage;