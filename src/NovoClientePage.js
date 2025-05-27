import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, Timestamp, query, where, getDocs } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import { IMaskInput } from 'react-imask';
import { cpf, cnpj } from 'cpf-cnpj-validator';
import './NovoProcessoPage.css'; // Reutilizando CSS

const BackArrowIcon = () => <span style={{ marginRight: '0.5em' }}>&#8592;</span>;
const ValidIcon = () => <span className="validation-icon valid">&#10004;</span>;
const InvalidIcon = () => <span className="validation-icon invalid">&#10006;</span>;

const tiposPessoa = ['Pessoa Física', 'Pessoa Jurídica'];
const ufsBrasil = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function NovoClientePage() {
    const navigate = useNavigate();
    // Estados do Formulário
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
    const [enderecoUF, setEnderecoUF] = useState(ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
    const [observacoes, setObservacoes] = useState('');

    // Estados de Controle
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState('');
    const [cpfCnpjStatus, setCpfCnpjStatus] = useState('idle');
    const [loadingCEP, setLoadingCEP] = useState(false);
    const [cepStatus, setCepStatus] = useState('idle'); // 'idle', 'valid', 'invalid' para CEP

    useEffect(() => {
        let timer;
        if (submitSuccess) {
            timer = setTimeout(() => { setSubmitSuccess(''); }, 3500);
        }
        return () => clearTimeout(timer);
    }, [submitSuccess]);

    // Máscaras
    const cpfMask = '000.000.000-00';
    const cnpjMask = '00.000.000/0000-00';
    const telefoneMask = '(00) 00000-0000';
    const cepMask = '00000-000';

    // Validação CPF/CNPJ (onBlur)
    const handleCpfCnpjValidation = useCallback(() => {
        const valueToCheck = cpfCnpj;
        const cpfCnpjClean = valueToCheck.replace(/\D/g, '');
        if (cpfCnpjClean.length === 0) {
            setCpfCnpjStatus('idle');
            if (submitError && typeof submitError === 'string' && submitError.toLowerCase().includes(tipoPessoa === 'Pessoa Física' ? 'cpf' : 'cnpj')) {
                setSubmitError(null);
            }
            return;
        }
        let isValid = false;
        const expectedLength = tipoPessoa === 'Pessoa Física' ? 11 : 14;

        if (cpfCnpjClean.length === expectedLength) {
            isValid = tipoPessoa === 'Pessoa Física' ? cpf.isValid(cpfCnpjClean) : cnpj.isValid(cpfCnpjClean);
        }
        
        setCpfCnpjStatus(isValid ? 'valid' : 'invalid');

        if (!isValid && cpfCnpjClean.length >= expectedLength) { // Mostra erro se o tamanho está completo mas é inválido
             setSubmitError(`Dígitos verificadores inválidos para ${tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'}.`);
        } else if (cpfCnpjClean.length > 0 && cpfCnpjClean.length !== expectedLength && cpfCnpjStatus !== 'idle' ) {
            // Não seta erro aqui se ainda estiver digitando, apenas atualiza o status visual para invalid
            // O erro de comprimento será pego no validateForm
        } else if (isValid) {
            if (submitError && typeof submitError === 'string' && submitError.toLowerCase().includes(tipoPessoa === 'Pessoa Física' ? 'cpf' : 'cnpj')) {
                 setSubmitError(null);
            }
        }
    }, [cpfCnpj, tipoPessoa, submitError]); // Adicionado submitError

    // Busca Endereço pelo CEP
    const handleCepBlur = async () => {
        const cepLimpo = enderecoCEP.replace(/\D/g, '');
        if (cepLimpo.length === 0) {
            setCepStatus('idle'); 
            setEnderecoLogradouro(''); setEnderecoBairro(''); setEnderecoCidade(''); setEnderecoUF(ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
            // Limpa erro de CEP se existir
            if (submitError && typeof submitError === 'string' && submitError.toLowerCase().includes("cep")) setSubmitError(null);
            return;
        }
        if (cepLimpo.length !== 8) {
            setSubmitError("CEP incompleto. Deve conter 8 dígitos.");
            setCepStatus('invalid');
            return;
        }
        setLoadingCEP(true); setSubmitError(null); setCepStatus('idle');
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            if (!response.ok) throw new Error(`Erro na API ViaCEP: ${response.status}`);
            const data = await response.json();
            if (data.erro) {
                setSubmitError("CEP não encontrado ou inválido.");
                setCepStatus('invalid');
                setEnderecoLogradouro(''); setEnderecoBairro(''); setEnderecoCidade(''); setEnderecoUF(ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
            } else {
                setEnderecoLogradouro(data.logradouro || '');
                setEnderecoBairro(data.bairro || '');
                setEnderecoCidade(data.localidade || '');
                setEnderecoUF(data.uf || ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
                setCepStatus('valid');
                setSubmitError(null);
                const numeroField = document.getElementById("enderecoNumero");
                if(numeroField) numeroField.focus();
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
            setSubmitError("Erro ao buscar informações do CEP.");
            setCepStatus('invalid');
        } finally {
            setLoadingCEP(false);
        }
    };

    // Validação geral do formulário
    const validateForm = () => {
        if (!submitError || (submitError && !submitError.toLowerCase().includes(tipoPessoa === 'Pessoa Física' ? 'cpf' : 'cnpj') && !submitError.toLowerCase().includes("cep"))) {
            setSubmitError(null);
        }
        if (!nomeCompleto.trim()) { setSubmitError('Nome / Razão Social é obrigatório.'); return false; }
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
        } else { if(cpfCnpjStatus !== 'idle') setCpfCnpjStatus('idle'); }
        // Validação de CEP (se preenchido, deve estar válido ou busca bem-sucedida)
        const cepClean = enderecoCEP.replace(/\D/g, '');
        if (cepClean.length > 0 && cepStatus !== 'valid') {
            setSubmitError("CEP inválido ou não verificado. Por favor, aguarde a busca ou corrija.");
            return false;
        }
        return true;
    };

    // Submit
    const handleSubmit = async (event) => {
        event.preventDefault();
        handleCpfCnpjValidation(); // Garante que o status do CPF/CNPJ é o mais recente
        if (enderecoCEP.replace(/\D/g, '').length === 8 && cepStatus === 'idle') { // Se CEP está completo mas não foi "blured"
            await handleCepBlur(); // Espera a busca do CEP
            // Revalida o form após a busca do CEP (validateForm pode ser assíncrono agora ou ter um callback)
            // Por simplicidade, o usuário pode precisar clicar em salvar novamente se o CEP preencher campos que afetem a validação.
            // Ou, idealmente, validateForm seria chamado após o estado do CEP ser resolvido.
        }
        if (!validateForm()) { window.scrollTo(0, 0); return; }

        setIsSubmitting(true); setSubmitError(null); setSubmitSuccess('');
        const currentUser = auth.currentUser;
        if (!currentUser) { setSubmitError("Usuário não autenticado."); setIsSubmitting(false); return; }

        const cpfCnpjClienteLimpo = cpfCnpj.replace(/\D/g, '');
        if (cpfCnpjClienteLimpo.length > 0) {
            try {
                const q = query( collection(db, "clientes"), where("cpfCnpjNumerico", "==", cpfCnpjClienteLimpo), where("userId", "==", currentUser.uid));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setSubmitError(`Cliente com este ${tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'} já existe.`);
                    setIsSubmitting(false); return;
                }
            } catch (error) { setSubmitError("Erro ao verificar duplicidade."); setIsSubmitting(false); return; }
        }

        const novoCliente = {
            nomeCompleto: nomeCompleto.trim(), tipoPessoa: tipoPessoa,
            cpfCnpj: cpfCnpj, cpfCnpjNumerico: cpfCnpjClienteLimpo,
            emailPrincipal: emailPrincipal.trim(), telefonePrincipal: telefonePrincipal,
            enderecoCEP: enderecoCEP, enderecoLogradouro: enderecoLogradouro.trim(),
            enderecoNumero: enderecoNumero.trim(), enderecoComplemento: enderecoComplemento.trim(),
            enderecoBairro: enderecoBairro.trim(), enderecoCidade: enderecoCidade.trim(),
            enderecoUF: enderecoUF, observacoes: observacoes.trim(),
            userId: currentUser.uid, criadoEm: Timestamp.now(), atualizadoEm: Timestamp.now()
        };

        try {
            await addDoc(collection(db, "clientes"), novoCliente);
            setSubmitSuccess(`Cliente "${novoCliente.nomeCompleto}" salvo com sucesso!`);
            setNomeCompleto(''); setTipoPessoa(tiposPessoa[0]); setCpfCnpj(''); setEmailPrincipal('');
            setTelefonePrincipal(''); setEnderecoCEP(''); setEnderecoLogradouro(''); setEnderecoNumero('');
            setEnderecoComplemento(''); setEnderecoBairro(''); setEnderecoCidade(''); setEnderecoUF(ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
            setObservacoes(''); setCpfCnpjStatus('idle'); setCepStatus('idle');
            setTimeout(() => { setSubmitSuccess(''); navigate('/clientes'); }, 2000);
        } catch (e) { console.error("Erro:", e); setSubmitError("Erro ao salvar cliente."); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="novo-processo-page">
            <div className="page-header">
                <h2 className="page-title">Adicionar Novo Cliente</h2>
                <button type="button" onClick={() => navigate('/clientes')} className="button-secondary-alt" disabled={isSubmitting}>
                    <BackArrowIcon /> Voltar para Lista
                </button>
            </div>

            <form onSubmit={handleSubmit} className="processo-form-card">
                <div className="feedback-container">
                    {submitError && <p className="form-feedback error">{submitError}</p>}
                    {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
                </div>

                <div className="form-grid">
                    {/* ... (Campos Nome, Tipo Pessoa, CPF/CNPJ com IMaskInput e onBlur) ... */}
                    <div className="form-group full-width"> <label htmlFor="nomeCompleto">Nome / Razão Social:</label> <input type="text" id="nomeCompleto" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required disabled={isSubmitting} /> </div>
                    <div className="form-group"> <label htmlFor="tipoPessoa">Tipo de Pessoa:</label> <select id="tipoPessoa" value={tipoPessoa} onChange={(e)=>{setTipoPessoa(e.target.value); setCpfCnpj(''); setCpfCnpjStatus('idle'); setSubmitError(null);}} disabled={isSubmitting}>{tiposPessoa.map(t => <option key={t} value={t}>{t}</option>)}</select> </div>
                    <div className="form-group"> <label htmlFor="cpfCnpj">{tipoPessoa === 'Pessoa Física' ? 'CPF' : 'CNPJ'}:</label> <div className={`input-with-validation ${cpfCnpjStatus}`}> <IMaskInput mask={tipoPessoa === 'Pessoa Física' ? cpfMask : cnpjMask} lazy={true} placeholderChar=" " value={cpfCnpj} onAccept={(value) => { setCpfCnpj(value); setCpfCnpjStatus('idle'); if (submitError && submitError.toLowerCase().includes(tipoPessoa === 'Pessoa Física' ? 'cpf' : 'cnpj')) setSubmitError(null);}} onBlur={handleCpfCnpjValidation} id="cpfCnpj" disabled={isSubmitting} placeholder={tipoPessoa === 'Pessoa Física' ? '___.___.___-__' : '__.___.___/____-__'} key={tipoPessoa} /> {cpfCnpjStatus === 'valid' && <ValidIcon />} {cpfCnpjStatus === 'invalid' && <InvalidIcon />} </div> </div>
                    <div className="form-group"> <label htmlFor="emailPrincipal">E-mail Principal:</label> <input type="email" id="emailPrincipal" value={emailPrincipal} onChange={(e) => setEmailPrincipal(e.target.value)} disabled={isSubmitting} placeholder="email@exemplo.com"/> </div>
                    <div className="form-group"> <label htmlFor="telefonePrincipal">Telefone Principal:</label> <IMaskInput mask={telefoneMask} value={telefonePrincipal} onAccept={(value) => setTelefonePrincipal(value)} id="telefonePrincipal" disabled={isSubmitting} placeholder="(XX) XXXXX-XXXX"/> </div>
                    
                    <h3 className='form-section-title full-width'>Endereço</h3>
                    <div className="form-group">
                        <label htmlFor="enderecoCEP">CEP:</label>
                        <div className={`input-with-feedback ${loadingCEP ? '' : cepStatus}`}>
                            <IMaskInput mask={cepMask} value={enderecoCEP}
                                onAccept={(value) => { setEnderecoCEP(value); setCepStatus('idle'); if(submitError && submitError.includes("CEP")) setSubmitError(null);}}
                                onBlur={handleCepBlur}
                                id="enderecoCEP" disabled={isSubmitting || loadingCEP} placeholder="_____-___"
                            />
                            {loadingCEP && <span className="loading-cep-spinner"></span>}
                            {!loadingCEP && cepStatus === 'valid' && <ValidIcon />}
                            {!loadingCEP && cepStatus === 'invalid' && <InvalidIcon />}
                        </div>
                    </div>
                    <div className="form-group"></div> {/* Espaçador */}
                    <div className="form-group full-width"> <label htmlFor="enderecoLogradouro">Logradouro:</label> <input type="text" id="enderecoLogradouro" value={enderecoLogradouro} onChange={(e) => setEnderecoLogradouro(e.target.value)} disabled={isSubmitting || loadingCEP} /> </div>
                    <div className="form-group"> <label htmlFor="enderecoNumero">Número:</label> <input type="text" id="enderecoNumero" value={enderecoNumero} onChange={(e) => setEnderecoNumero(e.target.value)} disabled={isSubmitting || loadingCEP} /> </div>
                    <div className="form-group"> <label htmlFor="enderecoComplemento">Complemento:</label> <input type="text" id="enderecoComplemento" value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} disabled={isSubmitting || loadingCEP} /> </div>
                    <div className="form-group"> <label htmlFor="enderecoBairro">Bairro:</label> <input type="text" id="enderecoBairro" value={enderecoBairro} onChange={(e) => setEnderecoBairro(e.target.value)} disabled={isSubmitting || loadingCEP} /> </div>
                    <div className="form-group"> <label htmlFor="enderecoCidade">Cidade:</label> <input type="text" id="enderecoCidade" value={enderecoCidade} onChange={(e) => setEnderecoCidade(e.target.value)} disabled={isSubmitting || loadingCEP} /> </div>
                    <div className="form-group"> <label htmlFor="enderecoUF">UF:</label> <select id="enderecoUF" value={enderecoUF} onChange={(e) => setEnderecoUF(e.target.value)} disabled={isSubmitting || loadingCEP}>{ufsBrasil.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></div>
                    <div className="form-group"></div> {/* Espaçador */}
                    
                    <h3 className='form-section-title full-width'>Observações</h3>
                    <div className="form-group full-width"> <textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows="4" disabled={isSubmitting}></textarea></div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="button-primary-alt" disabled={isSubmitting || loadingCEP}> {isSubmitting ? 'Salvando...' : 'Salvar Cliente'} </button>
                    <button type="button" onClick={() => navigate('/clientes')} className="button-secondary-alt" disabled={isSubmitting}> Cancelar </button>
                </div>
            </form>
        </div>
    );
}

export default NovoClientePage;