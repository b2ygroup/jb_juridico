import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import './NovoProcessoPage.css'; // Reutilizando o CSS existente para formulários

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;

// Constantes de opções (você pode movê-las para um arquivo compartilhado no futuro)
const tiposTarefa = ["Prazo", "Audiência", "Reunião", "Tarefa Interna", "Outro"];
const statusTarefa = ["Pendente", "Em Andamento", "Concluído", "Cancelado"];

// Função Helper para formatar Timestamp para input datetime-local (YYYY-MM-DDTHH:mm)
const formatTimestampForDateTimeInput = (timestamp) => {
  if (!timestamp) return '';
  let dateObject = null;
  if (timestamp instanceof Timestamp) { dateObject = timestamp.toDate(); }
  else if (timestamp instanceof Date) { dateObject = timestamp; }
  else { return ''; }
  const tzoffset = dateObject.getTimezoneOffset() * 60000;
  const localDate = new Date(dateObject.getTime() - tzoffset);
  const formattedString = localDate.toISOString().slice(0, 16);
  return formattedString;
};

function EditarTarefaPage() {
  const { idTarefa } = useParams(); // Pega o ID do item da agenda da URL
  const navigate = useNavigate();

  // Estados do Formulário
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState(tiposTarefa[0]);
  const [dataHoraInicio, setDataHoraInicio] = useState('');
  const [dataHoraFim, setDataHoraFim] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState(statusTarefa[0]);
  const [processoVinculadoId, setProcessoVinculadoId] = useState('');
  const [clienteVinculadoId, setClienteVinculadoId] = useState('');

  // Estados de Controle e Listas
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [listaProcessos, setListaProcessos] = useState([]);
  const [loadingProcessos, setLoadingProcessos] = useState(true);
  const [listaClientes, setListaClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);

  // Efeito para buscar Clientes e Processos (para dropdowns)
  useEffect(() => {
    let isMounted = true;
    const currentUser = auth.currentUser;
    if (!currentUser && isMounted) { 
        setLoadingClientes(false); 
        setLoadingProcessos(false); 
        return;
    }

    const fetchData = async (collectionName, setStateFunc, setLoadingFunc, orderByField = "criadoEm") => {
      if (!isMounted) return;
      setLoadingFunc(true);
      const dataList = [{ id: '', display: `-- Selecione ${collectionName === 'processos' ? 'um Processo' : 'um Cliente'} (Opcional) --` }];
      try {
        const q = query( collection(db, collectionName), where("userId", "==", currentUser.uid), orderBy(orderByField, collectionName === 'processos' ? "desc" : "asc") );
        const querySnapshot = await getDocs(q);
        if (!isMounted) return;
        querySnapshot.forEach((doc) => {
          let display = '';
          if (collectionName === 'processos') { display = doc.data().numeroOficial || doc.data().numeroInterno || `ID:${doc.id.substring(0,5)}`; }
          else { display = doc.data().nomeCompleto || 'Cliente sem nome'; }
          dataList.push({ id: doc.id, display: display, nome: doc.data().nomeCompleto });
        });
        setStateFunc(dataList);
      } catch (error) { console.error(`Erro: `, error); if (isMounted) { setSubmitError(`Erro ao carregar ${collectionName}.`); } }
      finally { if (isMounted) { setLoadingFunc(false); } }
    };

    if(isMounted) {
        fetchData("processos", setListaProcessos, setLoadingProcessos, "criadoEm");
        fetchData("clientes", setListaClientes, setLoadingClientes, "nomeCompleto");
    }
    return () => { isMounted = false; };
  }, []); // Roda só uma vez

  // Efeito para buscar dados da Tarefa/Evento a ser editado
  useEffect(() => {
    let isMounted = true;
    const fetchTarefa = async () => {
      if (!idTarefa) { if (isMounted) { setSubmitError("ID inválido para edição."); setLoadingData(false); setNotFound(true); } return; }
      if (isMounted) { setLoadingData(true); setNotFound(false); setSubmitError(null); }
      try {
        const docRef = doc(db, "agendaItens", idTarefa);
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitulo(data.titulo || '');
          setTipo(data.tipo || tiposTarefa[0]);
          setDataHoraInicio(formatTimestampForDateTimeInput(data.dataHoraInicio));
          setDataHoraFim(formatTimestampForDateTimeInput(data.dataHoraFim));
          setDescricao(data.descricao || '');
          setStatus(data.status || statusTarefa[0]);
          setProcessoVinculadoId(data.processoId || '');
          setClienteVinculadoId(data.clienteId || '');
        } else { if (isMounted) { setSubmitError("Item da agenda não encontrado."); setNotFound(true); } }
      } catch (err) { console.error("Erro ao buscar item da agenda:", err); if (isMounted) { setSubmitError("Erro ao carregar dados do item."); setNotFound(true); } }
      finally { if (isMounted) { setLoadingData(false); } }
    };
    if (idTarefa) { // Somente busca se idTarefa existir
        fetchTarefa();
    } else {
        if(isMounted) { setLoadingData(false); setNotFound(true); setSubmitError("ID do item da agenda não fornecido.");}
    }
    return () => { isMounted = false; };
  }, [idTarefa]);

   // Validação Simples
   const validateForm = () => {
    setSubmitError(null);
    if (!titulo.trim()) { setSubmitError('Título é obrigatório.'); return false; }
    if (!dataHoraInicio) { setSubmitError('Data e Hora de Início são obrigatórios.'); return false; }
    if (dataHoraFim && dataHoraInicio && new Date(dataHoraFim) < new Date(dataHoraInicio)) {
         setSubmitError('Data/Hora Fim deve ser posterior ao Início.'); return false;
    }
    return true;
  };

  // Submit (usa updateDoc)
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) { window.scrollTo(0, 0); return; }

    setIsSubmitting(true); setSubmitError(null); setSubmitSuccess('');

    const clienteInfo = listaClientes.find(c => c.id === clienteVinculadoId && c.id !== '');
    const processoInfo = listaProcessos.find(p => p.id === processoVinculadoId && p.id !== '');
    
    const docRef = doc(db, "agendaItens", idTarefa);
    const dadosAtualizados = {
      titulo: titulo.trim(),
      tipo: tipo,
      dataHoraInicio: dataHoraInicio ? Timestamp.fromDate(new Date(dataHoraInicio)) : null,
      dataHoraFim: dataHoraFim ? Timestamp.fromDate(new Date(dataHoraFim)) : null,
      descricao: descricao.trim(),
      status: status,
      processoId: processoVinculadoId || null,
      processoDisplay: processoInfo?.display || '',
      clienteId: clienteVinculadoId || null,
      clienteNome: clienteInfo?.nome || '',
      atualizadoEm: Timestamp.now()
      // userId e criadoEm não são atualizados
    };

    try {
      await updateDoc(docRef, dadosAtualizados);
      setSubmitSuccess(`Item "${dadosAtualizados.titulo}" atualizado na agenda com sucesso!`);
      setTimeout(() => { 
        setSubmitSuccess('');
        navigate('/agenda'); // Volta para lista da agenda
      }, 2000);
    } catch (e) {
        console.error("Erro ao atualizar item na agenda: ", e);
        setSubmitError("Erro ao salvar as alterações.");
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Renderização ---
  if (loadingData || loadingClientes || loadingProcessos) { 
    return (<div className="novo-processo-page"><p className="loading-message">Carregando dados...</p></div>); 
  }
  if (notFound) { 
    return ( <div className="novo-processo-page"> <div className="page-header"> <h2 className="page-title">Erro</h2> <button onClick={() => navigate('/agenda')} className="button-secondary-alt"><BackArrowIcon /> Voltar para Agenda</button> </div> <p className="error-message">{submitError || "Item da agenda não encontrado."}</p> </div> ); 
  }

  return (
    <div className="novo-processo-page">
      <div className="page-header">
        <h2 className="page-title">Editar Item da Agenda</h2>
        <button type="button" onClick={() => navigate('/agenda')} className="button-secondary-alt" disabled={isSubmitting}>
          <BackArrowIcon /> Cancelar Edição
        </button>
      </div>

      <form onSubmit={handleSubmit} className="processo-form-card">
         <div className="feedback-container">
            {submitError ? <p className="form-feedback error">{submitError}</p> : null}
            {submitSuccess ? <p className="form-feedback success">{submitSuccess}</p> : null}
        </div>

        <div className="form-grid">
          {/* Título */}
          <div className="form-group full-width"> <label htmlFor="tituloTarefaEdit">Título:</label> <input type="text" id="tituloTarefaEdit" value={titulo} onChange={(e) => setTitulo(e.target.value)} required disabled={isSubmitting} /> </div>
          {/* Tipo */}
          <div className="form-group"> <label htmlFor="tipoTarefaEdit">Tipo:</label> <select id="tipoTarefaEdit" value={tipo} onChange={(e) => setTipo(e.target.value)} required disabled={isSubmitting}>{tiposTarefa.map(t => <option key={t} value={t}>{t}</option>)}</select> </div>
          {/* Status */}
          <div className="form-group"> <label htmlFor="statusTarefaEdit">Status:</label> <select id="statusTarefaEdit" value={status} onChange={(e) => setStatus(e.target.value)} required disabled={isSubmitting}>{statusTarefa.map(s => <option key={s} value={s}>{s}</option>)}</select> </div>
          {/* Data/Hora Início */}
          <div className="form-group"> <label htmlFor="dataHoraInicioEdit">Data/Hora Início:</label> <input type="datetime-local" id="dataHoraInicioEdit" value={dataHoraInicio} onChange={(e) => setDataHoraInicio(e.target.value)} required disabled={isSubmitting} /> </div>
          {/* Data/Hora Fim */}
          <div className="form-group"> <label htmlFor="dataHoraFimEdit">Data/Hora Fim (Opcional):</label> <input type="datetime-local" id="dataHoraFimEdit" value={dataHoraFim} onChange={(e) => setDataHoraFim(e.target.value)} disabled={isSubmitting} min={dataHoraInicio || ''}/> </div>
          {/* Vínculo Processo */}
          <div className="form-group"> <label htmlFor="processoVinculadoEdit">Vincular Processo (Opcional):</label> <select id="processoVinculadoEdit" value={processoVinculadoId} onChange={(e) => setProcessoVinculadoId(e.target.value)} disabled={isSubmitting || loadingProcessos}>{listaProcessos.map(p => <option key={p.id || 'd-proc'} value={p.id}>{p.display}</option>)}</select> </div>
          {/* Vínculo Cliente */}
          <div className="form-group"> <label htmlFor="clienteVinculadoEdit">Vincular Cliente (Opcional):</label> <select id="clienteVinculadoEdit" value={clienteVinculadoId} onChange={(e) => setClienteVinculadoId(e.target.value)} disabled={isSubmitting || loadingClientes}>{listaClientes.map(c => <option key={c.id || 'd-cli'} value={c.id}>{c.display}</option>)}</select> </div>
          {/* Descrição */}
          <div className="form-group full-width"> <label htmlFor="descricaoTarefaEdit">Descrição / Detalhes:</label> <textarea id="descricaoTarefaEdit" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="4" disabled={isSubmitting}></textarea> </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button-primary-alt" disabled={isSubmitting || loadingClientes || loadingProcessos}>
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button type="button" onClick={() => navigate('/agenda')} className="button-secondary-alt" disabled={isSubmitting}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditarTarefaPage;