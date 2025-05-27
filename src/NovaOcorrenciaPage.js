import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, Timestamp, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, auth, storage } from './firebaseConfig';
import './NovoProcessoPage.css';
import './NovaOcorrenciaPage.css';

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const SendIcon = () => <span style={{ marginLeft: '0.5em' }}>&#10148;</span>;
const UploadIcon = () => <span style={{fontSize: '1em', marginRight: '0.3em'}}>&#128228;</span>;

const tiposCasoCliente = [
  "", "Trabalhista", "Consumidor", "Família", "Divórcio", "Pensão Alimentícia",
  "Inventário/Herança", "Imobiliário", "Contratual", "Criminal",
  "Previdenciário (INSS)", "Outro"
];

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/png", "image/heic", "image/heif"
];

function NovaOcorrenciaPage() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [tipoCaso, setTipoCaso] = useState('');
  const [descricaoDetallhada, setDescricaoDetallhada] = useState('');
  const [arquivosParaUpload, setArquivosParaUpload] = useState([]);
  const [arquivosCarregados, setArquivosCarregados] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [userName, setUserName] = useState('');
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser) {
      const fetchUserName = async () => {
        const userDocRef = doc(db, "usuarios", currentUser.uid);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
            setUserName(docSnap.data().nome || currentUser.email);
            } else { setUserName(currentUser.email); }
        } catch (e) { setUserName(currentUser.email); }
      };
      fetchUserName();
    }
  }, [currentUser]);

  useEffect(() => {
    let timer;
    if (submitSuccess) {
      timer = setTimeout(() => {
        setSubmitSuccess('');
        navigate('/portal-cliente');
      }, 3500);
    }
    return () => clearTimeout(timer);
  }, [submitSuccess, navigate]);

  const uploadFile = useCallback(async (fileToUpload) => {
    if (!currentUser) return Promise.reject(new Error("Usuário não autenticado."));

    const uniqueFileName = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;
    const filePath = `users/${currentUser.uid}/ocorrencias_anexos/${uniqueFileName}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

    setUploadProgress(prev => ({
        ...prev,
        [fileToUpload.name]: { progress: 0, error: null, task: uploadTask }
    }));

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(prev => ({ ...prev, [fileToUpload.name]: { ...prev[fileToUpload.name], progress: Math.round(progress) } }));
            },
            (error) => {
                console.error("Erro no upload do arquivo:", fileToUpload.name, error);
                setUploadProgress(prev => ({ ...prev, [fileToUpload.name]: { ...prev[fileToUpload.name], error: error.message || "Falha no upload" } }));
                setArquivosParaUpload(prevFiles => prevFiles.filter(f => f.name !== fileToUpload.name));
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const fileDetails = {
                        nome: fileToUpload.name, url: downloadURL, path: filePath,
                        tipo: fileToUpload.type, tamanho: fileToUpload.size,
                    };
                    setArquivosCarregados(prevLoaded => [...prevLoaded, fileDetails]);
                    setArquivosParaUpload(prevToUpload => prevToUpload.filter(f => f.name !== fileToUpload.name));
                    setUploadProgress(prevProg => ({ ...prevProg, [fileToUpload.name]: { ...prevProg[fileToUpload.name], progress: 100 } }));
                    resolve(fileDetails);
                } catch (urlError) {
                    console.error("Erro ao obter URL de download:", urlError);
                    setUploadProgress(prevProg => ({ ...prevProg, [fileToUpload.name]: { ...prevProg[fileToUpload.name], error: "Falha ao obter URL" } }));
                    reject(urlError);
                }
            }
        );
    });
  }, [currentUser]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    let currentErrors = [];
    let filesToQueue = [];

    files.forEach(file => {
        if (arquivosParaUpload.length + arquivosCarregados.length + filesToQueue.length >= 5) {
            currentErrors.push("Você pode anexar no máximo 5 arquivos no total.");
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) { currentErrors.push(`"${file.name}" excede ${MAX_FILE_SIZE_MB}MB.`); }
        else if (!ALLOWED_FILE_TYPES.includes(file.type)) { currentErrors.push(`Tipo de "${file.name}" não é permitido.`); }
        else if (![...arquivosParaUpload, ...arquivosCarregados].find(f => f.nome === file.name) && !filesToQueue.find(f => f.name === file.name)) {
            filesToQueue.push(file);
        } else { currentErrors.push(`"${file.name}" já selecionado ou enviado.`); }
    });

    if (currentErrors.length > 0) { setSubmitError(currentErrors.join("\n")); }
    else { setSubmitError(null); }

    setArquivosParaUpload(prev => [...prev, ...filesToQueue]);
    filesToQueue.forEach(file => uploadFile(file).catch(err => {
        console.warn("Upload individual falhou na chamada:", file.name, err);
        // O erro já deve ser tratado em uploadFile para atualizar uploadProgress[file.name].error
    }));
    event.target.value = null;
  };

  const removeArquivo = async (fileNameToRemove) => {
    const progressoArquivo = uploadProgress[fileNameToRemove];
    if (progressoArquivo && progressoArquivo.task && progressoArquivo.progress < 100 && !progressoArquivo.error) {
        progressoArquivo.task.cancel();
        console.log(`Upload de ${fileNameToRemove} cancelado.`);
    }
    setArquivosParaUpload(prev => prev.filter(f => f.name !== fileNameToRemove));
    const carregado = arquivosCarregados.find(f => f.nome === fileNameToRemove);
    setArquivosCarregados(prev => prev.filter(f => f.nome !== fileNameToRemove));
    setUploadProgress(prev => { const newState = {...prev}; delete newState[fileNameToRemove]; return newState; });

    if (carregado && carregado.path) {
        try {
            const fileRef = ref(storage, carregado.path);
            await deleteObject(fileRef);
            console.log(`Arquivo ${fileNameToRemove} deletado do Storage.`);
        } catch (deleteError) {
            console.error(`Erro ao deletar ${fileNameToRemove} do Storage:`, deleteError);
            setSubmitError(prev => (prev ? prev + "\n" : "") + `Falha ao remover o arquivo "${fileNameToRemove}" do armazenamento.`);
        }
    }
  };

  // --- validateForm COMPLETO ---
  const validateForm = () => {
    setSubmitError(null);
    if (!titulo.trim()) {
      setSubmitError('Por favor, forneça um título ou assunto para o seu caso.');
      return false;
    }
    if (!tipoCaso) {
      setSubmitError('Por favor, selecione o tipo de caso.');
      return false;
    }
    if (!descricaoDetallhada.trim()) {
      setSubmitError('Por favor, descreva detalhadamente o seu caso.');
      return false;
    }
    if (descricaoDetallhada.trim().length < 30) {
        setSubmitError('Sua descrição é muito curta. Por favor, forneça mais detalhes (mínimo 30 caracteres).');
        return false;
    }
    return true;
  };

  // --- handleSubmit COMPLETO ---
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) { window.scrollTo(0, 0); return; }

    const uploadsPendentes = arquivosParaUpload.filter(f => !uploadProgress[f.name] || (uploadProgress[f.name]?.progress < 100 && !uploadProgress[f.name]?.error) );
    if (uploadsPendentes.length > 0) {
        setSubmitError("Aguarde todos os uploads serem concluídos ou remova os arquivos pendentes antes de enviar.");
        return;
    }

    setIsSubmittingForm(true); setSubmitError(null); setSubmitSuccess('');

    if (!currentUser) {
      setSubmitError("Erro: Você precisa estar logado para enviar uma ocorrência.");
      setIsSubmittingForm(false); navigate('/auth'); return;
    }

    const novaOcorrencia = {
      titulo: titulo.trim(), tipoCaso: tipoCaso,
      descricaoDetallhada: descricaoDetallhada.trim(),
      arquivosAnexados: arquivosCarregados, // Usa a lista de arquivos já upados
      statusOcorrencia: "Enviada", clienteId: currentUser.uid,
      clienteNome: userName || currentUser.displayName || currentUser.email,
      clienteEmail: currentUser.email, criadoEm: Timestamp.now(),
      advogadoResponsavelId: null, advogadoResponsavelNome: null,
      protocoloInternoGerado: null, processoPrincipalIdVinculado: null,
    };

    try {
      const docRef = await addDoc(collection(db, "ocorrencias"), novaOcorrencia);
      setSubmitSuccess(`Sua ocorrência "${novaOcorrencia.titulo}" foi enviada com sucesso! Protocolo: ${docRef.id.substring(0,8).toUpperCase()}.`);
      setTitulo(''); setTipoCaso(''); setDescricaoDetallhada('');
      setArquivosParaUpload([]); setArquivosCarregados([]); setUploadProgress({});
    } catch (e) {
      console.error("Erro ao salvar ocorrência no Firestore: ", e);
      setSubmitError("Ocorreu um erro ao salvar sua ocorrência. Os arquivos (se houver) foram enviados, mas os detalhes do caso não. Por favor, contate o suporte.");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // --- Renderização ---
  return (
    <div className="novo-processo-page ocorrencia-form-page">
      <div className="page-header">
        <h2 className="page-title">Relatar Novo Caso ou Solicitação</h2>
        <button onClick={() => navigate('/portal-cliente')} className="button-secondary-alt" disabled={isSubmittingForm}>
          <BackArrowIcon /> Voltar ao Portal
        </button>
      </div>

      <form onSubmit={handleSubmit} className="processo-form-card ocorrencia-form-card-custom">
        <div className="feedback-container">
          {submitError && (<pre className="form-feedback error" style={{whiteSpace:'pre-wrap', textAlign:'left'}}>{submitError}</pre>)}
          {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
          {Object.values(uploadProgress).some(p => p.progress < 100 && !p.error && arquivosParaUpload.length > 0) && !submitSuccess &&
            <p className="form-feedback info" style={{whiteSpace:'pre-wrap', textAlign:'left'}}>
                Enviando arquivos... Por favor, aguarde.
            </p>
          }
        </div>

        <div className="form-grid-single-column">
          <div className="form-group full-width">
            <label htmlFor="tituloOcorrencia">Assunto / Título Breve do Caso: *</label>
            <input type="text" id="tituloOcorrencia" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Problema com compra online, Atraso de salário, Divórcio" disabled={isSubmittingForm} />
          </div>

          <div className="form-group full-width">
            <label htmlFor="tipoCasoCliente">Tipo de Caso / Área do Direito: *</label>
            <select id="tipoCasoCliente" value={tipoCaso} onChange={(e) => setTipoCaso(e.target.value)} disabled={isSubmittingForm} required>
              {tiposCasoCliente.map(tipo => (<option key={tipo} value={tipo} disabled={tipo === ""}>{tipo === "" ? "-- Selecione uma área --" : tipo}</option>))}
            </select>
          </div>

          <div className="form-group full-width">
            <label htmlFor="descricaoDetallhada">Descreva seu caso em detalhes: *</label>
            <textarea id="descricaoDetallhada" rows="10" value={descricaoDetallhada} onChange={(e) => setDescricaoDetallhada(e.target.value)} required placeholder="Forneça o máximo de informações possível: datas importantes, nomes de outras partes envolvidas (se houver), o que já aconteceu, e qual sua dúvida ou objetivo." disabled={isSubmittingForm} />
          </div>

          <div className="form-group full-width">
            <label htmlFor="arquivosOcorrencia">Anexar Documentos/Evidências (Opcional - até 5 arquivos, máx. {MAX_FILE_SIZE_MB}MB cada):</label>
            <p className="info-text" style={{marginTop: 0, marginBottom:'0.5rem'}}>Formatos: PDF, DOC, DOCX, JPG, PNG, HEIC, HEIF.</p>
            <input type="file" id="arquivosOcorrencia" multiple onChange={handleFileChange} disabled={isSubmittingForm || (arquivosParaUpload.length + arquivosCarregados.length) >= 5} style={{padding: '0.5rem', border:'1px solid var(--cor-borda-input-claro, #4A5568)', borderRadius:'var(--raio-borda)' , backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--cor-texto-claro-principal, #cbd5e1)'}} accept={ALLOWED_FILE_TYPES.join(",")} />
            
            {(arquivosParaUpload.length > 0 || arquivosCarregados.length > 0) && (
              <div className="arquivos-selecionados-lista" style={{marginTop: '1rem'}}>
                <ul style={{listStyle:'none', paddingLeft:0}}>
                  {arquivosCarregados.map(file => (
                    <li key={file.nome + '-loaded'} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85em', marginBottom:'0.3em', padding:'0.3rem', backgroundColor:'rgba(var(--cor-sucesso-rgb, 40,167,69),0.1)', borderRadius:'4px'}}>
                      <span style={{flexGrow:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:'10px'}} title={file.nome}> {file.nome} (Enviado &#10004;) </span>
                      {!isSubmittingForm && <button type="button" onClick={() => removeArquivo(file.nome, file.path)} style={{background:'none', border:'none', color:'var(--cor-erro)', cursor:'pointer', fontSize:'1.3em', padding:'0 0.5em'}}>&times;</button>}
                    </li>
                  ))}
                  {arquivosParaUpload.map(file => (
                    <li key={file.name + '-uploading'} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85em', marginBottom:'0.3em', padding:'0.3rem', backgroundColor:'rgba(255,255,255,0.03)', borderRadius:'4px'}}>
                      <span style={{flexGrow:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:'10px'}} title={file.name}> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB) </span>
                      {uploadProgress[file.name]?.error && <span style={{marginLeft:'10px', color: 'var(--cor-erro)'}}>Falha!</span>}
                      {uploadProgress[file.name] && !uploadProgress[file.name].error && uploadProgress[file.name].progress < 100 && <span style={{marginLeft:'10px', color: 'var(--cor-acento)'}}>{uploadProgress[file.name].progress}%</span> }
                      {!isSubmittingForm && <button type="button" onClick={() => removeArquivo(file.name, null)} style={{background:'none', border:'none', color:'var(--cor-erro)', cursor:'pointer', fontSize:'1.3em', padding:'0 0.5em'}}>&times;</button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
             {(arquivosParaUpload.length + arquivosCarregados.length) >= 5 && <p className="info-text error" style={{color: 'var(--cor-erro)', marginTop:'0.5rem'}}>Limite de 5 arquivos atingido.</p>}
          </div>
        </div>

        <div className="form-actions" style={{marginTop: '2rem'}}>
          <button type="submit" className="button-primary-alt" disabled={isSubmittingForm || arquivosParaUpload.some(f => !uploadProgress[f.name]?.error && uploadProgress[f.name]?.progress < 100) }>
            <SendIcon /> {isSubmittingForm ? (arquivosParaUpload.length > 0 ? 'Enviando Arquivos...' : 'Salvando Dados...') : 'Enviar Ocorrência'}
          </button>
          <button type="button" onClick={() => navigate('/portal-cliente')} className="button-secondary-alt" disabled={isSubmittingForm}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default NovaOcorrenciaPage;