import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, Timestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import './NovoProcessoPage.css'; // Reutilizando CSS

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const AddIcon = () => <span style={{ marginRight: '0.5em' }}>&#43;</span>;

const tiposTarefa = ["Prazo", "Audiência", "Reunião", "Tarefa Interna", "Outro"];
const statusTarefa = ["Pendente", "Em Andamento", "Concluído", "Cancelado"];

function NovaTarefaPage() {
    const navigate = useNavigate();

    const [titulo, setTitulo] = useState('');
    const [tipo, setTipo] = useState(tiposTarefa[0]);
    const [dataHoraInicio, setDataHoraInicio] = useState('');
    const [dataHoraFim, setDataHoraFim] = useState('');
    const [descricao, setDescricao] = useState('');
    const [status, setStatus] = useState(statusTarefa[0]);
    const [processoVinculadoId, setProcessoVinculadoId] = useState('');
    const [clienteVinculadoId, setClienteVinculadoId] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState('');
    const [listaProcessos, setListaProcessos] = useState([]);
    const [loadingProcessos, setLoadingProcessos] = useState(true);
    const [listaClientes, setListaClientes] = useState([]);
    const [loadingClientes, setLoadingClientes] = useState(true);

    useEffect(() => {
        let timer;
        if (submitSuccess) {
            timer = setTimeout(() => { setSubmitSuccess(''); }, 3500);
        }
        return () => clearTimeout(timer);
    }, [submitSuccess]);

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setLoadingClientes(false);
            setLoadingProcessos(false);
            return;
        }
        let isMounted = true; // Adicionado para cleanup
        const fetchData = async (collectionName, setStateFunc, setLoadingFunc, orderByField = "criadoEm") => {
            if (!isMounted) return;
            setLoadingFunc(true);
            const dataList = [{ id: '', display: `-- Selecione ${collectionName === 'processos' ? 'um Processo' : 'um Cliente'} (Opcional) --` }];
            try {
                const q = query(
                    collection(db, collectionName),
                    where("userId", "==", currentUser.uid),
                    orderBy(orderByField, collectionName === 'processos' ? "desc" : "asc")
                );
                const querySnapshot = await getDocs(q);
                if (!isMounted) return;
                querySnapshot.forEach((doc) => {
                    let display = '';
                    if (collectionName === 'processos') {
                        display = doc.data().numeroOficial || doc.data().numeroInterno || `ID:${doc.id.substring(0, 5)}`;
                    } else {
                        display = doc.data().nomeCompleto || 'Cliente sem nome';
                    }
                    dataList.push({ id: doc.id, display: display, nome: doc.data().nomeCompleto });
                });
                setStateFunc(dataList);
            } catch (error) {
                console.error(`Erro ao buscar ${collectionName}: `, error);
                if (isMounted) {
                    setSubmitError(`Erro ao carregar lista de ${collectionName === 'processos' ? 'processos' : 'clientes'}.`);
                }
            } finally {
                if (isMounted) { setLoadingFunc(false); }
            }
        };

        fetchData("processos", setListaProcessos, setLoadingProcessos, "criadoEm");
        fetchData("clientes", setListaClientes, setLoadingClientes, "nomeCompleto");

        return () => { isMounted = false; }; // Cleanup para fetchData
    }, []);

    const validateForm = () => {
        setSubmitError(null);
        if (!titulo.trim()) { setSubmitError('Título é obrigatório.'); return false; }
        if (!dataHoraInicio) { setSubmitError('Data e Hora de Início são obrigatórios.'); return false; }
        if (dataHoraFim && dataHoraInicio && new Date(dataHoraFim) < new Date(dataHoraInicio)) {
            setSubmitError('A Data/Hora de Fim deve ser posterior à Data/Hora de Início.'); return false;
        }
        return true;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validateForm()) { window.scrollTo(0, 0); return; }

        setIsSubmitting(true); setSubmitError(null); setSubmitSuccess('');
        const currentUser = auth.currentUser;
        if (!currentUser) { setSubmitError("Usuário não autenticado."); setIsSubmitting(false); return; }

        const processoInfo = listaProcessos.find(p => p.id === processoVinculadoId);
        const clienteInfo = listaClientes.find(c => c.id === clienteVinculadoId);

        const novaTarefa = {
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
            userId: currentUser.uid,
            criadoEm: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        };

        try {
            await addDoc(collection(db, "agendaItens"), novaTarefa);
            setSubmitSuccess(`"${novaTarefa.titulo}" adicionado à agenda com sucesso!`);
            setTitulo(''); setTipo(tiposTarefa[0]); setDataHoraInicio(''); setDataHoraFim('');
            setDescricao(''); setStatus(statusTarefa[0]); setProcessoVinculadoId(''); setClienteVinculadoId('');
            setTimeout(() => {
                setSubmitSuccess('');
                navigate('/agenda');
            }, 2000);
        } catch (e) {
            console.error("Erro ao adicionar item na agenda: ", e);
            setSubmitError("Erro ao salvar item na agenda.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="novo-processo-page">
            <div className="page-header">
                <h2 className="page-title">Adicionar Item à Agenda</h2>
                {/* BOTÃO VOLTAR CORRIGIDO */}
                <button onClick={() => navigate('/agenda')} className="button-secondary-alt" disabled={isSubmitting}>
                    <BackArrowIcon /> Voltar para Agenda
                </button>
            </div>

            <form onSubmit={handleSubmit} className="processo-form-card">
                <div className="feedback-container">
                    {submitError && <p className="form-feedback error">{submitError}</p>}
                    {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
                </div>

                <div className="form-grid">
                    {/* Título */}
                    <div className="form-group full-width">
                        <label htmlFor="tituloTarefa">Título:</label>
                        <input type="text" id="tituloTarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} required disabled={isSubmitting} placeholder="Ex: Audiência Processo X, Prazo Petição Y, Reunião Cliente Z"/>
                    </div>
                    {/* Tipo */}
                    <div className="form-group">
                        <label htmlFor="tipoTarefa">Tipo:</label>
                        <select id="tipoTarefa" value={tipo} onChange={(e) => setTipo(e.target.value)} required disabled={isSubmitting}>
                            {tiposTarefa.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {/* Status */}
                     <div className="form-group">
                        <label htmlFor="statusTarefa">Status:</label>
                        <select id="statusTarefa" value={status} onChange={(e) => setStatus(e.target.value)} required disabled={isSubmitting}>
                            {statusTarefa.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {/* Data/Hora Início */}
                    <div className="form-group">
                        <label htmlFor="dataHoraInicio">Data/Hora Início:</label>
                        <input type="datetime-local" id="dataHoraInicio" value={dataHoraInicio} onChange={(e) => setDataHoraInicio(e.target.value)} required disabled={isSubmitting} />
                    </div>
                    {/* Data/Hora Fim */}
                     <div className="form-group">
                        <label htmlFor="dataHoraFim">Data/Hora Fim (Opcional):</label>
                        <input type="datetime-local" id="dataHoraFim" value={dataHoraFim} onChange={(e) => setDataHoraFim(e.target.value)} disabled={isSubmitting} min={dataHoraInicio || ''}/>
                    </div>
                    {/* Vínculo Processo */}
                    <div className="form-group">
                         <label htmlFor="processoVinculado">Vincular ao Processo (Opcional):</label>
                         <select id="processoVinculado" value={processoVinculadoId} onChange={(e) => setProcessoVinculadoId(e.target.value)} disabled={isSubmitting || loadingProcessos}>
                            {listaProcessos.map(p => <option key={p.id || 'default-proc'} value={p.id}>{p.display}</option>)}
                         </select>
                    </div>
                    {/* Vínculo Cliente */}
                    <div className="form-group">
                         <label htmlFor="clienteVinculado">Vincular ao Cliente (Opcional):</label>
                         <select id="clienteVinculado" value={clienteVinculadoId} onChange={(e) => setClienteVinculadoId(e.target.value)} disabled={isSubmitting || loadingClientes}>
                            {listaClientes.map(c => <option key={c.id || 'default-cli'} value={c.id}>{c.display}</option>)}
                         </select>
                    </div>
                    {/* Descrição */}
                    <div className="form-group full-width">
                        <label htmlFor="descricaoTarefa">Descrição / Detalhes:</label>
                        <textarea id="descricaoTarefa" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="4" disabled={isSubmitting}></textarea>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="button-primary-alt" disabled={isSubmitting || loadingClientes || loadingProcessos}>
                        {isSubmitting ? 'Salvando...' : 'Salvar na Agenda'}
                    </button>
                    <button type="button" onClick={() => navigate('/agenda')} className="button-secondary-alt" disabled={isSubmitting}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}

export default NovaTarefaPage;