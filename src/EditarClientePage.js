import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from './firebaseConfig';
import { IMaskInput } from 'react-imask';
import { cpf, cnpj } from 'cpf-cnpj-validator';
import './NovoProcessoPage.css'; // Reutilizando CSS

// Componentes de Ícones Simples
const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const ValidIcon = () => <span className="validation-icon valid">&#10004;</span>;
const InvalidIcon = () => <span className="validation-icon invalid">&#10006;</span>;
const EditIcon = () => <span style={{ marginRight: '0.5em' }}>&#9998;</span>;

// Constantes
const tiposPessoa = ['Pessoa Física', 'Pessoa Jurídica'];
const ufsBrasil = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

// Função Helper
const formatTimestampForInput = (timestamp) => {
  if (timestamp instanceof Timestamp) { return timestamp.toDate().toISOString().split('T')[0]; }
  else if (timestamp instanceof Date) { return timestamp.toISOString().split('T')[0]; }
  return '';
};

// Componente Principal
function EditarClientePage() {
  const { idCliente } = useParams();
  const navigate = useNavigate();

  // Estados
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState(tiposPessoa[0]);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [emailPrincipal, setEmailPrincipal] = useState('');
  const [telefonePrincipal, setTelefonePrincipal] = useState('');
  const [enderecoCEP, setEnderecoCEP] = useState('');
  const [enderecoLogradouro, setEnderecoLogradouro] = useState('');
  const [enderecoNumero, setEnderecoNumero] = useState('');
  const [enderecoComplemento, setEnderecoComplemento] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [enderecoCidade, setEnderecoCidade] = useState('');
  const [enderecoUF, setEnderecoUF] = useState(ufsBrasil[24]);
  const [observacoes, setObservacoes] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [cpfCnpjStatus, setCpfCnpjStatus] = useState('idle');
  const [originalCpfCnpj, setOriginalCpfCnpj] = useState('');

  // Definições de Máscara
  const cpfMask = '000.000.000-00';
  const cnpjMask = '00.000.000/0000-00';
  const currentCpfCnpjMaskDefinition = { mask: tipoPessoa === 'Pessoa Física' ? cpfMask : cnpjMask, lazy: true, placeholderChar: ' ' };
  const telefoneMask = '(00) 00000-0000';
  const cepMask = '00000-000';

  // Validação CPF/CNPJ (useCallback)
  const handleCpfCnpjValidation = useCallback(() => {
      const valueToCheck = cpfCnpj;
      const cpfCnpjClean = valueToCheck.replace(/\D/g, '');
      if (cpfCnpjClean.length === 0) { setCpfCnpjStatus('idle'); return; }
      let isValid = false;
      if (tipoPessoa === 'Pessoa Física') {
          if(cpfCnpjClean.length === 11) isValid = cpf.isValid(cpfCnpjClean);
      } else if (tipoPessoa === 'Pessoa Jurídica') {
          if(cpfCnpjClean.length === 14) isValid = cnpj.isValid(cpfCnpjClean);
      }
      setCpfCnpjStatus(isValid ? 'valid' : 'invalid');
  }, [cpfCnpj, tipoPessoa]);

  // Efeito para buscar dados
  useEffect(() => {
    let isMounted = true;
    const fetchCliente = async () => {
      if (!idCliente) { if (isMounted) { setSubmitError("ID inválido."); setLoadingData(false); setNotFound(true); } return; }
      if (isMounted) { setLoadingData(true); setNotFound(false); setSubmitError(null); }
      try {
        const docRef = doc(db, "clientes", idCliente);
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNomeCompleto(data.nomeCompleto || '');
          setTipoPessoa(data.tipoPessoa || tiposPessoa[0]);
          const currentCpfCnpjValue = data.cpfCnpj || '';
          setCpfCnpj(currentCpfCnpjValue);
          setOriginalCpfCnpj(currentCpfCnpjValue);
          setEmailPrincipal(data.emailPrincipal || '');
          setTelefonePrincipal(data.telefonePrincipal || '');
          setEnderecoCEP(data.enderecoCEP || '');
          setEnderecoLogradouro(data.enderecoLogradouro || '');
          setEnderecoNumero(data.enderecoNumero || '');
          setEnderecoComplemento(data.enderecoComplemento || '');
          setEnderecoBairro(data.enderecoBairro || '');
          setEnderecoCidade(data.enderecoCidade || '');
          setEnderecoUF(data.enderecoUF || ufsBrasil[24]);
          setObservacoes(data.observacoes || '');
          // Valida o dado carregado
          const loadedCpfCnpjClean = currentCpfCnpjValue.replace(/\D/g, '');
          if (loadedCpfCnpjClean.length === 0) { setCpfCnpjStatus('idle'); }
          else {
              let isValidLoaded = false;
              if ((data.tipoPessoa || tiposPessoa[0]) === 'Pessoa Física') {
                  if(loadedCpfCnpjClean.length === 11) isValidLoaded = cpf.isValid(loadedCpfCnpjClean);
              } else {
                   if(loadedCpfCnpjClean.length === 14) isValidLoaded = cnpj.isValid(loadedCpfCnpjClean);
              }
              setCpfCnpjStatus(isValidLoaded ? 'valid' : 'invalid');
          }
        } else { if (isMounted) { setSubmitError("Cliente não encontrado."); setNotFound(true); } }
      } catch (err) { console.error("Erro:", err); if (isMounted) { setSubmitError("Erro ao carregar dados."); setNotFound(true); } }
      finally { if (isMounted) { setLoadingData(false); } }
    };
    fetchCliente();
    return () => { isMounted = false; };
  }, [idCliente]); // Apenas idCliente como dependência explícita é suficiente aqui

  // Validação geral do formulário
  const validateForm = () => {
      setSubmitError(null);
      if (!nomeCompleto.trim()) { setSubmitError('Nome / Razão Social é obrigatório.'); return false; }
      const numOficialClean = ''; // Variável não usada aqui, removida
      const cpfCnpjClean = cpfCnpj.replace(/\D/g, '');
      if (cpfCnpjClean.length > 0) {
          const expectedLength = tipoPessoa === 'Pessoa Física' ? 11 : 14;
          if (cpfCnpjClean.length !== expectedLength) {
              setSubmitError(`Comprimento inválido para ${tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'}.`);
              setCpfCnpjStatus('invalid'); return false;
          }
          const isValid = tipoPessoa === 'Pessoa Física' ? cpf.isValid(cpfCnpjClean) : cnpj.isValid(cpfCnpjClean);
          if (!isValid) {
              setSubmitError(`Dígitos verificadores inválidos para ${tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'}.`);
              setCpfCnpjStatus('invalid'); return false;
          } else {
              if(cpfCnpjStatus !== 'valid') setCpfCnpjStatus('valid');
          }
      } else {
           if(cpfCnpjStatus !== 'idle') setCpfCnpjStatus('idle');
      }
      // Removida validação que exigia número interno/oficial, pois não se aplica a cliente
      // if (!numeroInterno.trim() && !numOficialClean && !cliente.trim()) { ... }
      return true;
  };

  // Submit do formulário
  const handleSubmit = async (event) => {
    event.preventDefault();
    // Não precisa chamar handleCpfCnpjValidation() aqui, validateForm já faz a checagem
    if (!validateForm()) { window.scrollTo(0, 0); return; }

    setIsSubmitting(true); setSubmitError(null); setSubmitSuccess('');

    const cpfCnpjClienteLimpo = cpfCnpj.replace(/\D/g, '');
    const originalCpfCnpjLimpo = originalCpfCnpj.replace(/\D/g, '');

    // Verificação de Duplicidade (APENAS SE MUDOU)
    if (cpfCnpjClienteLimpo.length > 0 && cpfCnpj !== originalCpfCnpj) {
        try {
            const q = query(collection(db, "clientes"), where("cpfCnpjNumerico", "==", cpfCnpjClienteLimpo));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                let isSelf = false;
                querySnapshot.forEach((docFound) => { if (docFound.id === idCliente) { isSelf = true; } });
                if (!isSelf) {
                    setSubmitError(`Já existe outro cliente com este ${tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'}.`);
                    setIsSubmitting(false); return;
                }
            }
        } catch (error) {
             console.error("Erro:", error); setSubmitError("Erro ao verificar CPF/CNPJ."); setIsSubmitting(false); return;
        }
    }

    // Atualização...
    const docRef = doc(db, "clientes", idCliente);
    const dadosAtualizados = {
      nomeCompleto: nomeCompleto.trim(), tipoPessoa: tipoPessoa,
      cpfCnpj: cpfCnpj, cpfCnpjNumerico: cpfCnpjClienteLimpo,
      emailPrincipal: emailPrincipal.trim(), telefonePrincipal: telefonePrincipal,
      enderecoCEP: enderecoCEP, enderecoLogradouro: enderecoLogradouro.trim(),
      enderecoNumero: enderecoNumero.trim(), enderecoComplemento: enderecoComplemento.trim(),
      enderecoBairro: enderecoBairro.trim(), enderecoCidade: enderecoCidade.trim(),
      enderecoUF: enderecoUF, observacoes: observacoes.trim(),
      atualizadoEm: Timestamp.now()
    };

    try {
      await updateDoc(docRef, dadosAtualizados);
      setSubmitSuccess(`Cliente "${dadosAtualizados.nomeCompleto}" atualizado com sucesso!`);
      setTimeout(() => { navigate(`/clientes/${idCliente}`); }, 2000);
    } catch (e) { console.error("Erro:", e); setSubmitError("Erro ao salvar."); setIsSubmitting(false); }
  };

  // --- Renderização ---
  if (loadingData) { return (<div className="novo-processo-page"><p className="loading-message">Carregando...</p></div>); }
  if (notFound || (submitError && !isSubmitting && !submitSuccess)) { return (
        <div className="novo-processo-page"> <div className="page-header"> <h2 className="page-title">Erro</h2> <button onClick={() => navigate('/clientes')} className="button-secondary-alt"><BackArrowIcon /> Voltar</button> </div> <p className="error-message">{submitError || "Cliente não encontrado."}</p> </div> ); }

 return (
    <div className="novo-processo-page">
      <div className="page-header">
        <h2 className="page-title">Editar Cliente</h2>
        <button type="button" onClick={() => navigate(`/clientes/${idCliente}`)} className="button-secondary-alt" disabled={isSubmitting}>
          <BackArrowIcon /> Cancelar Edição
        </button>
      </div>

      <form onSubmit={handleSubmit} className="processo-form-card">
         {/* Feedback Container */}
         <div className="feedback-container">
            {/* Sintaxe revisada e simplificada */}
            { submitError ? <p className="form-feedback error">{submitError}</p> : null }
            { submitSuccess ? <p className="form-feedback success">{submitSuccess}</p> : null }
        </div>

        {/* Form Grid */}
        <div className="form-grid">
          {/* Dados Principais */}
          <div className="form-group full-width"> <label htmlFor="nomeCompletoEdit">Nome / Razão Social:</label> <input type="text" id="nomeCompletoEdit" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="tipoPessoaEdit">Tipo de Pessoa:</label> <select id="tipoPessoaEdit" value={tipoPessoa} onChange={(e)=>{setTipoPessoa(e.target.value); setCpfCnpj(''); setCpfCnpjStatus('idle');}} disabled={isSubmitting}>{tiposPessoa.map(t => <option key={t} value={t}>{t}</option>)}</select> </div>
          <div className="form-group"> <label htmlFor="cpfCnpjEdit">{tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'}:</label> <div className={`input-with-validation ${cpfCnpjStatus}`}> <IMaskInput mask={currentCpfCnpjMaskDefinition.mask} lazy={true} placeholderChar=" " value={cpfCnpj} onAccept={(value) => { setCpfCnpj(value); setCpfCnpjStatus('idle'); setSubmitError(null); }} onBlur={handleCpfCnpjValidation} id="cpfCnpjEdit" disabled={isSubmitting} placeholder={tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'} key={tipoPessoa} /> {cpfCnpjStatus === 'valid' && <ValidIcon />} {cpfCnpjStatus === 'invalid' && <InvalidIcon />} </div> </div>
          {/* Contato */}
          <div className="form-group"> <label htmlFor="emailPrincipalEdit">E-mail Principal:</label> <input type="email" id="emailPrincipalEdit" value={emailPrincipal} onChange={(e) => setEmailPrincipal(e.target.value)} disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="telefonePrincipalEdit">Telefone Principal:</label> <IMaskInput mask={telefoneMask} id="telefonePrincipalEdit" value={telefonePrincipal} onAccept={setTelefonePrincipal} disabled={isSubmitting}/> </div>
          {/* Endereço */}
          <h3 className='form-section-title full-width'>Endereço</h3>
          <div className="form-group"> <label htmlFor="enderecoCEPEdit">CEP:</label> <IMaskInput mask={cepMask} id="enderecoCEPEdit" value={enderecoCEP} onAccept={setEnderecoCEP} disabled={isSubmitting}/> </div>
          <div className="form-group"></div>
          <div className="form-group full-width"> <label htmlFor="enderecoLogradouroEdit">Logradouro:</label> <input type="text" id="enderecoLogradouroEdit" value={enderecoLogradouro} onChange={(e) => setEnderecoLogradouro(e.target.value)} disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="enderecoNumeroEdit">Número:</label> <input type="text" id="enderecoNumeroEdit" value={enderecoNumero} onChange={(e) => setEnderecoNumero(e.target.value)} disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="enderecoComplementoEdit">Complemento:</label> <input type="text" id="enderecoComplementoEdit" value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="enderecoBairroEdit">Bairro:</label> <input type="text" id="enderecoBairroEdit" value={enderecoBairro} onChange={(e) => setEnderecoBairro(e.target.value)} disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="enderecoCidadeEdit">Cidade:</label> <input type="text" id="enderecoCidadeEdit" value={enderecoCidade} onChange={(e) => setEnderecoCidade(e.target.value)} disabled={isSubmitting} /> </div>
          <div className="form-group"> <label htmlFor="enderecoUFEdit">UF:</label> <select id="enderecoUFEdit" value={enderecoUF} onChange={(e) => setEnderecoUF(e.target.value)} disabled={isSubmitting}>{ufsBrasil.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></div>
          <div className="form-group"></div>
          {/* Observações */}
          <h3 className='form-section-title full-width'>Observações</h3>
          <div className="form-group full-width"> <textarea id="observacoesEdit" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows="4" disabled={isSubmitting}></textarea></div>
        </div>

        {/* Botões de Ação */}
        <div className="form-actions">
          <button type="submit" className="button-primary-alt" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando Alterações...' : 'Salvar Alterações'}
          </button>
          <button type="button" onClick={() => navigate(`/clientes/${idCliente}`)} className="button-secondary-alt" disabled={isSubmitting}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  ); // Fim do return principal
} // Fim do componente EditarClientePage

export default EditarClientePage;