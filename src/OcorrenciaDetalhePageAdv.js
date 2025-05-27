import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp, collection, addDoc as addSubDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, auth, storage } from './firebaseConfig';
import './OcorrenciaDetalhePageAdv.css';
import WorkflowActionModal from './WorkflowActionModal';

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const FileIcon = () => <span style={{ marginRight: '0.5em' }}>&#128196;</span>;
const ProcessIcon = () => <span style={{ marginRight: '0.5em' }}>&#128221;</span>;
const EditStatusIcon = () => <span style={{ marginRight: '0.5em' }}>&#9998;</span>;
const RejectIcon = () => <span style={{ marginRight: '0.5em' }}>&#10060;</span>;
const HistoryIcon = () => <span style={{ marginRight: '0.5em' }}>&#128337;</span>;

const formatDateDetalhe = (timestamp) => {
  if (!timestamp) return 'Data não disponível';
  let dateObject = null;
  if (timestamp instanceof Timestamp) {
    dateObject = timestamp.toDate();
  } else {
    const date = new Date(timestamp);
    if (!isNaN(date.valueOf())) {
      dateObject = date;
    }
  }
  if (dateObject) {
    return dateObject.toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
  return String(timestamp);
};

function OcorrenciaDetalhePageAdv() {
  const { idOcorrencia } = useParams();
  const navigate = useNavigate();
  const [ocorrencia, setOcorrencia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const currentUser = auth.currentUser;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAcao, setModalAcao] = useState('');
  const [modalTitulo, setModalTitulo] = useState('');
  const [historicoStatus, setHistoricoStatus] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [uploadingStepFiles, setUploadingStepFiles] = useState(false);

  const fetchOcorrencia = useCallback(async () => {
    if (!idOcorrencia) { setError("ID da ocorrência não fornecido."); setLoading(false); setOcorrencia(null); return; }
    setLoading(true); setError(null); setSuccessMessage('');
    try {
      const docRef = doc(db, "ocorrencias", idOcorrencia);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setOcorrencia({ id: docSnap.id, ...docSnap.data() });
      } else { setError("Ocorrência não encontrada."); setOcorrencia(null); }
    } catch (err) { console.error("Erro ao buscar ocorrência:", err); setError("Falha ao carregar os dados da ocorrência."); setOcorrencia(null); }
    finally { setLoading(false); }
  }, [idOcorrencia]);

  useEffect(() => {
    fetchOcorrencia();
  }, [fetchOcorrencia]);

  useEffect(() => {
    if (!idOcorrencia) return;
    setLoadingHistorico(true);
    const historicoRef = collection(db, "ocorrencias", idOcorrencia, "atualizacoes");
    const q = query(historicoRef, orderBy("dataAtualizacao", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach(docItem => items.push({id: docItem.id, ...docItem.data()})); // Renomeado doc para docItem
      setHistoricoStatus(items);
      setLoadingHistorico(false);
    }, (err) => { console.error("Erro histórico:", err); setLoadingHistorico(false); });
    return () => unsubscribe();
  }, [idOcorrencia]);

  const abrirModalParaAcao = (acao, tituloModal) => {
    setModalAcao(acao);
    setModalTitulo(tituloModal); // Usando o parâmetro renomeado
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async (novoStatus, notas, arquivosDoModal = []) => {
    if (!ocorrencia || !currentUser) {
      setError("Não foi possível atualizar: ocorrência ou usuário não definidos.");
      return;
    }
    setIsUpdatingStatus(true); setError(null); setSuccessMessage(''); setUploadingStepFiles(false);
    const statusAnterior = ocorrencia.statusOcorrencia;
    let anexosDaEtapaFirestore = [];

    if (arquivosDoModal.length > 0) {
        setUploadingStepFiles(true);
        const uploadPromises = arquivosDoModal.map(file => {
            const uniqueFileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const filePath = `ocorrencias/${idOcorrencia}/atualizacoes_anexos/${Timestamp.now().toMillis()}_${uniqueFileName}`;
            const storageRef = ref(storage, filePath);
            const uploadTask = uploadBytesResumable(storageRef, file);
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`Upload de ${file.name} está ${progress}% concluído`);
                    },
                    (error) => { console.error("Erro upload etapa:", error); reject(error); },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve({ nome: file.name, url: downloadURL, path: filePath, tipo: file.type, tamanho: file.size });
                        } catch (urlError) { reject(urlError); }
                    }
                );
            });
        });
        try {
            anexosDaEtapaFirestore = await Promise.all(uploadPromises);
        } catch (uploadError) {
            setError("Falha no upload de arquivos da etapa. Status não atualizado.");
            setIsUpdatingStatus(false); setUploadingStepFiles(false); return;
        }
        setUploadingStepFiles(false);
    }

    try {
      const ocorrenciaRef = doc(db, "ocorrencias", idOcorrencia);
      const dadosUpdateOcorrencia = {
        statusOcorrencia: novoStatus,
        advogadoResponsavelId: currentUser.uid,
        advogadoResponsavelNome: currentUser.displayName || currentUser.email,
        statusAtualizadoEm: Timestamp.now()
      };
      if (novoStatus === "Recusada" && notas) { dadosUpdateOcorrencia.motivoRecusa = notas; }
      await updateDoc(ocorrenciaRef, dadosUpdateOcorrencia);

      const historicoRef = collection(db, "ocorrencias", idOcorrencia, "atualizacoes");
      await addSubDoc(historicoRef, {
        statusAnterior: statusAnterior, statusNovo: novoStatus,
        dataAtualizacao: dadosUpdateOcorrencia.statusAtualizadoEm, // Usa o mesmo timestamp
        advogadoId: currentUser.uid, advogadoNome: currentUser.displayName || currentUser.email,
        notas: notas || "",
        arquivosAnexadosNestaEtapa: anexosDaEtapaFirestore
      });
      setOcorrencia(prev => prev ? {...prev, ...dadosUpdateOcorrencia, motivoRecusa: dadosUpdateOcorrencia.motivoRecusa !== undefined ? dadosUpdateOcorrencia.motivoRecusa : prev.motivoRecusa} : null);
      setSuccessMessage(`Status atualizado para "${novoStatus}".`);
    } catch (err) { console.error("Erro ao atualizar status/histórico:", err); setError("Não foi possível atualizar o status da ocorrência."); }
    finally { setIsUpdatingStatus(false); }
  };

  if (loading) { return <div className="loading-message" style={{ padding: '2rem', textAlign: 'center', color: 'var(--cor-texto-claro-principal)' }}>Carregando...</div>; }
  if (error && !ocorrencia) { return <div className="form-feedback error" style={{ margin: '2rem', padding: '1rem', textAlign: 'center' }}>{error}</div>; }
  if (!ocorrencia || typeof ocorrencia.titulo === 'undefined') { return <div className="loading-message" style={{ padding: '2rem', textAlign: 'center', color: 'var(--cor-texto-claro-principal)' }}>Dados da ocorrência não encontrados.</div>; }

  const podeGerarProcesso = ocorrencia && !["Convertida em Processo", "Recusada", "Cancelada pelo Cliente"].includes(ocorrencia.statusOcorrencia);

  return (
    <>
      <WorkflowActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(notas, arquivos) => handleUpdateStatus(modalAcao, notas, arquivos)}
        acao={modalAcao}
        titulo={modalTitulo}
      />
      <div className="ocorrencia-detalhe-adv-page">
        <div className="page-header">
          <h2 className="page-title">Detalhes da Ocorrência / Lead</h2>
          <button onClick={() => navigate(document.referrer && document.referrer.includes('/ocorrencias') && !document.referrer.includes(idOcorrencia) ? '/ocorrencias' : '/')} className="button-secondary-alt">
            <BackArrowIcon /> Voltar
          </button>
        </div>

        {error && !successMessage && <p className="form-feedback error" style={{marginBottom: '1rem'}}>{error}</p>}
        {successMessage && <p className="form-feedback success" style={{marginBottom: '1rem'}}>{successMessage}</p>}

        <div className="ocorrencia-detalhe-card">
          <div className="detalhe-header">
            <h3>{ocorrencia.titulo}</h3>
            <span className={`status-badge status-${(ocorrencia.statusOcorrencia || 'desconhecido').toLowerCase().replace(/\s+/g, '-')}`}>
              {ocorrencia.statusOcorrencia}
            </span>
          </div>
          <p className="info-text-subtle">Protocolo Ocorrência: {ocorrencia.id.substring(0,8).toUpperCase()}</p>
          
          <div className="detalhe-grid two-columns">
            <div className="detalhe-item"><strong>Cliente:</strong> {ocorrencia.clienteNome || 'Não informado'}</div>
            <div className="detalhe-item"><strong>Email Cliente:</strong> {ocorrencia.clienteEmail || 'Não informado'}</div>
            <div className="detalhe-item"><strong>Telefone Cliente:</strong> {ocorrencia.clienteTelefone || 'Não informado'}</div>
            <div className="detalhe-item"><strong>Tipo de Caso:</strong> {ocorrencia.tipoCaso || 'Não informado'}</div>
            <div className="detalhe-item"><strong>Enviada em:</strong> {formatDateDetalhe(ocorrencia.criadoEm)}</div>
            {ocorrencia.advogadoResponsavelNome && ( <div className="detalhe-item"><strong>Advogado Responsável:</strong> {ocorrencia.advogadoResponsavelNome}</div> )}
            {ocorrencia.statusAtualizadoEm && ( <div className="detalhe-item"><strong>Status Atualizado em:</strong> {formatDateDetalhe(ocorrencia.statusAtualizadoEm)}</div> )}
          </div>

          <h4>Descrição Detalhada pelo Cliente:</h4>
          <p className="descricao-ocorrencia">{ocorrencia.descricaoDetallhada || "Nenhuma descrição fornecida."}</p>

          {ocorrencia.arquivosAnexados && ocorrencia.arquivosAnexados.length > 0 && (
            <>
              <h4><FileIcon />Arquivos Anexados pelo Cliente (Iniciais):</h4>
              <ul className="lista-arquivos-anexados">
                {ocorrencia.arquivosAnexados.map((arquivo, index) => (
                  <li key={`inicial-${index}`}>
                    <a href={arquivo.url} target="_blank" rel="noopener noreferrer" className="link-arquivo" title={`Abrir ${arquivo.nome}`}>{arquivo.nome}</a>
                    <span className="tamanho-arquivo"> ({(arquivo.tamanho / 1024 / 1024).toFixed(2)} MB) - Tipo: {arquivo.tipo || 'Desconhecido'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* --- CORREÇÃO DE SINTAXE DOS BOTÕES DE AÇÃO E DIV ABAIXO --- */}
          <div className="detalhe-actions" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(var(--cor-acento-rgb, 176, 141, 87), 0.2)' }}>
            {uploadingStepFiles && <p className="loading-text" style={{width:'100%', textAlign:'center', marginBottom:'1rem'}}>Enviando anexos da etapa...</p>}
            
            {ocorrencia.statusOcorrencia === "Enviada" && (
              <button onClick={() => abrirModalParaAcao("Em Análise", "Iniciar Análise da Ocorrência")} className="button-primary-alt" disabled={isUpdatingStatus || uploadingStepFiles} style={{marginRight: '1rem'}}>
                <EditStatusIcon/> {isUpdatingStatus ? "Atualizando..." : "Iniciar Análise"}
              </button>
            )}
            {ocorrencia.statusOcorrencia === "Em Análise" && (
              <>
                <button onClick={() => abrirModalParaAcao("Contato Realizado", "Registrar Contato com Cliente")} className="button-primary-alt" disabled={isUpdatingStatus || uploadingStepFiles} style={{marginRight: '1rem'}}>
                  <EditStatusIcon/> Marcar Contato Realizado
                </button>
                <button onClick={() => abrirModalParaAcao("Recusada", "Recusar Ocorrência (Informe o Motivo)")} className="button-danger" disabled={isUpdatingStatus || uploadingStepFiles} style={{marginRight: '1rem'}}>
                  <RejectIcon/> Recusar Ocorrência
                </button>
              </>
            )}
             {ocorrencia.statusOcorrencia === "Contato Realizado" && (
              <>
                 <button onClick={() => abrirModalParaAcao("Recusada", "Recusar Ocorrência (Informe o Motivo)")} className="button-danger" disabled={isUpdatingStatus || uploadingStepFiles} style={{marginRight: '1rem'}}>
                    <RejectIcon/> Recusar Ocorrência
                </button>
              </>
            )}

            {podeGerarProcesso && (
              <Link
                to={`/processos/novo?ocorrenciaId=${idOcorrencia}&clienteId=${ocorrencia.clienteId || ''}&clienteNome=${encodeURIComponent(ocorrencia.clienteNome || '')}&tipoCaso=${encodeURIComponent(ocorrencia.tipoCaso || '')}&tituloOcorrencia=${encodeURIComponent(ocorrencia.titulo || '')}&descricaoOcorrencia=${encodeURIComponent(ocorrencia.descricaoDetallhada || '')}`}
                className="button-success"
                style={isUpdatingStatus || uploadingStepFiles ? { pointerEvents: 'none', opacity: 0.5 } : {}}
              >
                <ProcessIcon /> Gerar Processo
              </Link>
            )}
          </div>
          {ocorrencia.statusOcorrencia === "Recusada" && ocorrencia.motivoRecusa && (
              <div className="detalhe-item" style={{marginTop: '1.5rem', borderTop:'1px solid rgba(var(--cor-erro-rgb, 169, 68, 66),0.3)', paddingTop:'1.5rem'}}>
                  <strong>Motivo da Recusa:</strong> {ocorrencia.motivoRecusa}
              </div>
          )}
        </div>

        <div className="ocorrencia-detalhe-card historico-card">
          <h4><HistoryIcon />Histórico da Ocorrência</h4>
          {loadingHistorico ? <p className="loading-text-portal">Carregando histórico...</p> : 
           historicoStatus.length > 0 ? (
            <ul className="lista-historico-status">
              {historicoStatus.map(item => (
                <li key={item.id}>
                  <div className="historico-data">{formatDateDetalhe(item.dataAtualizacao)}</div>
                  {/* CORREÇÃO DA LINHA ABAIXO */}
                  <div className="historico-info">
                    <strong>{item.advogadoNome || 'Sistema'}</strong> atualizou status de "{item.statusAnterior || 'N/A'}" para <strong>"{item.statusNovo}"</strong>.
                    {/* FIM DA LINHA CORRIGIDA */}
                    {item.statusAnterior && <span className="status-anterior">(Anterior: "{item.statusAnterior}")</span>}
                  </div>
                  {item.notas && <p className="historico-notas">Notas: {item.notas}</p>}
                  {item.arquivosAnexadosNestaEtapa && item.arquivosAnexadosNestaEtapa.length > 0 && (
                    <div className="historico-anexos">
                      <strong>Anexos desta atualização:</strong>
                      <ul>
                        {item.arquivosAnexadosNestaEtapa.map((arq, idx) => (
                          <li key={idx}><a href={arq.url} target="_blank" rel="noopener noreferrer" className="link-arquivo">{arq.nome}</a></li>
                        ))}
                      </ul>
                    </div> // <<< FECHAMENTO CORRETO DO DIV .historico-anexos
                  )}
                </li>
              ))}
            </ul>
           ) : <p>Nenhuma atualização no histórico ainda.</p>
          }
        </div>
      </div>
    </>
  );
}
export default OcorrenciaDetalhePageAdv;