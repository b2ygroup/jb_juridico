import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  onSnapshot // Adicionado para lista de clientes em tempo real
} from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import { IMaskInput } from 'react-imask';
import './NovoProcessoPage.css'; // Certifique-se que este arquivo CSS existe e está estilizado

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
// AddIcon não está sendo usado, pode ser removido se não houver uso futuro
// const AddIcon = () => <span style={{ marginRight: '0.5em' }}>&#43;</span>;

const tiposDeProcessoDefault = [
  "", // Para forçar seleção
  "Cível", "Trabalhista", "Criminal", "Família", "Empresarial", "Tributário",
  "Previdenciário", "Contratual", "Administrativo", "Consultivo", "Outro"
];
const statusDeProcessoDefault = [
  "Novo", "Em Andamento", "Suspenso", "Aguardando Documentos",
  "Pendente Análise", "Concluído", "Arquivado"
];

function NovoProcessoPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Estados do Formulário
  const [numeroInterno, setNumeroInterno] = useState('');
  const [numeroOficial, setNumeroOficial] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState('');
  const [clienteSelecionadoNome, setClienteSelecionadoNome] = useState(''); // Para exibir nome se pré-selecionado
  const [parteContraria, setParteContraria] = useState('');
  const [tipo, setTipo] = useState(''); // Inicia vazio
  const [status, setStatus] = useState(statusDeProcessoDefault[0]);
  const [dataAbertura, setDataAbertura] = useState(new Date().toISOString().split('T')[0]);
  const [valorCausa, setValorCausa] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Estados de Controle
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [listaClientes, setListaClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [ocorrenciaOriginariaId, setOcorrenciaOriginariaId] = useState(null);
  const [isClientePredefinido, setIsClientePredefinido] = useState(false); // Para controlar se o cliente veio da ocorrência

  // Efeito para buscar clientes em tempo real
  useEffect(() => {
    setLoadingClientes(true);
    const currentUser = auth.currentUser;
    if (currentUser) {
      const q = query(collection(db, "clientes"), where("userId", "==", currentUser.uid), orderBy("nomeCompleto", "asc"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const clientes = [];
        querySnapshot.forEach((doc) => {
          clientes.push({ id: doc.id, ...doc.data() });
        });
        setListaClientes(clientes);
        setLoadingClientes(false);
      }, (error) => {
        console.error("Erro ao buscar clientes: ", error);
        setSubmitError("Falha ao carregar lista de clientes.");
        setLoadingClientes(false);
      });
      return () => unsubscribe();
    } else {
      setLoadingClientes(false);
      setListaClientes([]);
    }
  }, []);

  // Efeito para pré-preenchimento com dados da ocorrência
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ocorrenciaIdParam = params.get('ocorrenciaId');
    const clienteIdParam = params.get('clienteId');
    const clienteNomeParam = params.get('clienteNome');
    const tipoCasoParam = params.get('tipoCaso');
    const tituloOcorrenciaParam = params.get('tituloOcorrencia');
    const descricaoOcorrenciaParam = params.get('descricaoOcorrencia');

    if (ocorrenciaIdParam) {
      setOcorrenciaOriginariaId(ocorrenciaIdParam);
      setNumeroInterno(`OC-${ocorrenciaIdParam.substring(0, 6).toUpperCase()}`); // Sugestão para número interno
    }
    if (clienteIdParam) {
      setClienteSelecionadoId(clienteIdParam);
      if (clienteNomeParam) {
        setClienteSelecionadoNome(decodeURIComponent(clienteNomeParam));
      }
      setIsClientePredefinido(true);
    }

    if (tipoCasoParam) {
      const tipoDecodificado = decodeURIComponent(tipoCasoParam);
      const tipoProcessoEncontrado = tiposDeProcessoDefault.find(tp => tp.toLowerCase() === tipoDecodificado.toLowerCase());
      if (tipoProcessoEncontrado) {
        setTipo(tipoProcessoEncontrado);
      } else if (tiposDeProcessoDefault.includes("Outro")) {
        setTipo("Outro");
        setObservacoes(prevObs => `${tipoDecodificado}\n${prevObs}`); // Adiciona tipo original nas observações
      }
    }

    let obsIniciais = '';
    if (tituloOcorrenciaParam) {
      obsIniciais += `Referente à Ocorrência Protocolo: ${ocorrenciaIdParam ? ocorrenciaIdParam.substring(0,6).toUpperCase() : 'N/A'}\nTítulo Original: ${decodeURIComponent(tituloOcorrenciaParam)}\n\n`;
    }
    if (descricaoOcorrenciaParam) {
      obsIniciais += `Descrição Original do Cliente:\n${decodeURIComponent(descricaoOcorrenciaParam)}`;
    }
    if (obsIniciais) {
      setObservacoes(prevObs => obsIniciais + (prevObs ? `\n\n--- Observações Adicionais ---\n${prevObs}` : ''));
    }
  }, [location.search]); // Executa quando os query params mudam

  // Efeito para limpar mensagem de sucesso
  useEffect(() => {
    let timer;
    if (submitSuccess) {
      timer = setTimeout(() => {
        setSubmitSuccess('');
        // A navegação ocorre dentro do handleSubmit agora
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [submitSuccess]);

  // Definição da máscara de moeda
  const currencyMaskDefinition = {
    mask: 'R$ num',
    blocks: {
      num: {
        mask: Number,
        scale: 2,
        thousandsSeparator: '.',
        padFractionalZeros: true,
        normalizeZeros: true,
        radix: ',',
        mapToRadix: ['.']
      }
    },
    lazy: true,
    placeholderChar: ' '
  };

  // Validação do formulário
  const validateForm = () => {
    setSubmitError(null);
    if (!numeroInterno.trim() && !numeroOficial.trim()) {
      setSubmitError("Pelo menos um número (Interno ou Oficial) deve ser preenchido.");
      return false;
    }
    if (!clienteSelecionadoId) {
      setSubmitError("Selecione um cliente para o processo.");
      return false;
    }
    if (!tipo) { // Verifica se um tipo de processo foi selecionado
      setSubmitError("Selecione o tipo do processo.");
      return false;
    }
    // Adicionar mais validações conforme necessário
    return true;
  };

  // Submit do formulário
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      window.scrollTo(0, 0); // Rola para o topo para ver o erro
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess('');
    const currentUserAuth = auth.currentUser; // Renomeado para evitar conflito com `currentUser` do App.js se passado
    if (!currentUserAuth) {
      setSubmitError("Usuário não autenticado. Por favor, faça login novamente.");
      setIsSubmitting(false);
      navigate('/auth'); // Redireciona para login se não autenticado
      return;
    }

    const nomeClienteFinal = isClientePredefinido ? 
                             clienteSelecionadoNome : 
                             (listaClientes.find(c => c.id === clienteSelecionadoId)?.nomeCompleto || 'Cliente não especificado');

    const novoProcesso = {
      numeroInterno: numeroInterno.trim(),
      numeroOficial: numeroOficial.trim(),
      numeroOficialNumerico: numeroOficial.replace(/\D/g, ''),
      clienteId: clienteSelecionadoId,
      clienteNome: nomeClienteFinal,
      parteContraria: parteContraria.trim(),
      tipo: tipo,
      status: status,
      dataAbertura: dataAbertura ? Timestamp.fromDate(new Date(dataAbertura + "T00:00:00")) : Timestamp.now(),
      valorCausa: String(valorCausa || 'R$ 0,00'), // Garante que é string
      valorCausaNumerico: parseFloat(String(valorCausa || '0').replace(/[R$.\s]/g, '').replace(',', '.')),
      observacoes: observacoes.trim(),
      userId: currentUserAuth.uid,
      criadoEm: Timestamp.now(),
      atualizadoEm: Timestamp.now(),
      ocorrenciaOriginariaId: ocorrenciaOriginariaId || null,
    };

    try {
      const docRef = await addDoc(collection(db, "processos"), novoProcesso);

      if (ocorrenciaOriginariaId) {
        const ocorrenciaRef = doc(db, "ocorrencias", ocorrenciaOriginariaId);
        await updateDoc(ocorrenciaRef, {
          statusOcorrencia: "Convertida em Processo",
          processoPrincipalIdVinculado: docRef.id,
          statusAtualizadoEm: Timestamp.now(),
        });
        console.log(`Ocorrência ${ocorrenciaOriginariaId} atualizada para 'Convertida em Processo' e vinculada ao processo ${docRef.id}`);
      }

      setSubmitSuccess(`Processo "${novoProcesso.numeroInterno || novoProcesso.numeroOficial}" salvo com sucesso!`);
      // Limpar campos do formulário
      setNumeroInterno('');
      setNumeroOficial('');
      setClienteSelecionadoId('');
      setClienteSelecionadoNome('');
      setParteContraria('');
      setTipo('');
      setStatus(statusDeProcessoDefault[0]);
      setDataAbertura(new Date().toISOString().split('T')[0]);
      setValorCausa('');
      setObservacoes('');
      setOcorrenciaOriginariaId(null);
      setIsClientePredefinido(false);

      setTimeout(() => {
        setSubmitSuccess('');
        navigate(`/processos/${docRef.id}`); // Navega para o detalhe do novo processo
      }, 2000);
    } catch (e) {
      console.error("Erro ao salvar processo: ", e);
      setSubmitError("Erro ao salvar o processo. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="novo-processo-page">
      <div className="page-header">
        <h2 className="page-title">{ocorrenciaOriginariaId ? "Novo Processo a Partir de Ocorrência" : "Adicionar Novo Processo"}</h2>
        <button onClick={() => navigate(ocorrenciaOriginariaId ? `/ocorrencias/${ocorrenciaOriginariaId}` : '/processos')} className="button-secondary-alt" disabled={isSubmitting}>
          <BackArrowIcon /> Voltar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="processo-form-card">
        <div className="feedback-container">
          {submitError && <p className="form-feedback error">{submitError}</p>}
          {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="numeroInterno">Número Interno (Sugestão: {`OC-${(ocorrenciaOriginariaId || "XXXXXX").substring(0,6).toUpperCase()}`}):</label>
            <input type="text" id="numeroInterno" value={numeroInterno} onChange={(e) => setNumeroInterno(e.target.value)} disabled={isSubmitting}/>
          </div>
          <div className="form-group">
            <label htmlFor="numeroOficial">Número Oficial (Tribunal):</label>
            <input type="text" id="numeroOficial" value={numeroOficial} onChange={(e) => setNumeroOficial(e.target.value)} disabled={isSubmitting}/>
          </div>
          
          <div className="form-group">
            <label htmlFor="clienteId">Cliente: *</label>
            {isClientePredefinido && clienteSelecionadoNome ? (
              <input type="text" value={clienteSelecionadoNome} disabled readOnly className="input-preenchido-disabled"/>
            ) : loadingClientes ? (
              <p className="loading-text">Carregando clientes...</p>
            ) : (
              <select id="clienteId" value={clienteSelecionadoId} onChange={(e) => setClienteSelecionadoId(e.target.value)} required disabled={isSubmitting || isClientePredefinido}>
                <option value="">-- Selecione um Cliente --</option>
                {listaClientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nomeCompleto}</option>
                ))}
              </select>
            )}
            {!isClientePredefinido && (
                <Link 
                    to={`/clientes/novo?origem=/processos/novo${location.search}`} // Passa os query params atuais para NovoCliente
                    className="link-add-new"
                >
                (Adicionar Novo Cliente)
                </Link>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="parteContraria">Parte Contrária:</label>
            <input type="text" id="parteContraria" value={parteContraria} onChange={(e) => setParteContraria(e.target.value)} disabled={isSubmitting}/>
          </div>
          <div className="form-group">
            <label htmlFor="tipoProcesso">Tipo de Processo: *</label>
            <select id="tipoProcesso" value={tipo} onChange={(e) => setTipo(e.target.value)} required disabled={isSubmitting}>
                {tiposDeProcessoDefault.map(t => <option key={t} value={t} disabled={t === ""}>{t===""?"-- Selecione --":t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="statusProcesso">Status: *</label>
            <select id="statusProcesso" value={status} onChange={(e) => setStatus(e.target.value)} required disabled={isSubmitting}>
                {statusDeProcessoDefault.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dataAbertura">Data de Abertura:</label>
            <input type="date" id="dataAbertura" value={dataAbertura} onChange={(e) => setDataAbertura(e.target.value)} disabled={isSubmitting}/>
          </div>
          <div className="form-group">
            <label htmlFor="valorCausa">Valor da Causa (R$):</label>
            <IMaskInput
                mask={currencyMaskDefinition.mask}
                blocks={currencyMaskDefinition.blocks}
                lazy={currencyMaskDefinition.lazy}
                radix="," // Define o separador decimal como vírgula
                mapToRadix={['.']} // Mapeia ponto para vírgula se digitado
                scale={2} // Duas casas decimais
                padFractionalZeros={true} // Adiciona zeros se necessário (ex: 10 -> 10,00)
                normalizeZeros={true} // Remove zeros à esquerda desnecessários
                id="valorCausa"
                value={String(valorCausa)} // Garante que o valor é uma string para o IMaskInput
                onAccept={(value) => setValorCausa(value)}
                disabled={isSubmitting}
                placeholder="R$ 0,00"
            />
          </div>
          
          <div className="form-group full-width">
            <label htmlFor="observacoes">Observações / Detalhes Iniciais:</label>
            <textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows="6" disabled={isSubmitting}></textarea>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button-primary-alt" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar Processo'}
          </button>
          <button type="button" onClick={() => navigate(ocorrenciaOriginariaId ? `/ocorrencias/${ocorrenciaOriginariaId}` : '/processos')} className="button-secondary-alt" disabled={isSubmitting}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default NovoProcessoPage;