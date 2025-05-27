import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, Timestamp, query, where, getDocs, collection } from "firebase/firestore";
import { auth, db } from './firebaseConfig';
import { IMaskInput } from 'react-imask';
import { cpf, cnpj } from 'cpf-cnpj-validator';
import './NovoProcessoPage.css'; // Reutilizando CSS

// Ícones
const AdvogadoIcon = () => <span className="role-icon">&#9878;</span>;
const ClienteIcon = () => <span className="role-icon">&#128100;</span>;
const ValidIcon = () => <span className="validation-icon valid">&#10004;</span>;
const InvalidIcon = () => <span className="validation-icon invalid">&#10006;</span>;

// Constantes
const ufsBrasil = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const tiposPessoaClienteOptions = ['Pessoa Física', 'Pessoa Jurídica'];
const estadosCivisOptions = ["", "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável", "Outro"];

function SignUp({ onSwitchMode, modoCompletarPerfil = false, usuarioExistente = null, onProfileCompleted }) {
  const navigate = useNavigate();

  // Estados Comuns
  const [etapaCadastro, setEtapaCadastro] = useState(
    modoCompletarPerfil && usuarioExistente?.papel && usuarioExistente.papel !== 'precisaCompletarCadastro' ? 2 : 1
  );
  const [papelSelecionado, setPapelSelecionado] = useState(
    modoCompletarPerfil && usuarioExistente?.papel && usuarioExistente.papel !== 'precisaCompletarCadastro' ? usuarioExistente.papel : ''
  );
  const [email, setEmail] = useState(modoCompletarPerfil && usuarioExistente?.email ? usuarioExistente.email : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState(modoCompletarPerfil && usuarioExistente?.nome ? usuarioExistente.nome : '');
  const [telefone, setTelefone] = useState(modoCompletarPerfil && usuarioExistente?.telefone ? usuarioExistente.telefone : '');

  // Estados Específicos do Advogado
  const [oab, setOab] = useState(modoCompletarPerfil && usuarioExistente?.oab ? usuarioExistente.oab : '');
  const [cpfAdvogado, setCpfAdvogado] = useState(modoCompletarPerfil && usuarioExistente?.cpfAdvogado ? usuarioExistente.cpfAdvogado : '');
  const [cpfAdvogadoStatus, setCpfAdvogadoStatus] = useState('idle');

  // Estados Específicos do Cliente (com novos campos)
  const [tipoPessoaCliente, setTipoPessoaCliente] = useState(
    modoCompletarPerfil && usuarioExistente?.tipoPessoaCliente ? usuarioExistente.tipoPessoaCliente : tiposPessoaClienteOptions[0]
  );
  const [cpfCnpjCliente, setCpfCnpjCliente] = useState(modoCompletarPerfil && usuarioExistente?.cpfCnpjCliente ? usuarioExistente.cpfCnpjCliente : '');
  const [cpfCnpjClienteStatus, setCpfCnpjClienteStatus] = useState('idle');
  const [dataNascimento, setDataNascimento] = useState(modoCompletarPerfil && usuarioExistente?.dataNascimento ? usuarioExistente.dataNascimento : '');
  const [estadoCivil, setEstadoCivil] = useState(modoCompletarPerfil && usuarioExistente?.estadoCivil ? usuarioExistente.estadoCivil : '');
  const [profissao, setProfissao] = useState(modoCompletarPerfil && usuarioExistente?.profissao ? usuarioExistente.profissao : '');
  const [nacionalidade, setNacionalidade] = useState(modoCompletarPerfil && usuarioExistente?.nacionalidade ? usuarioExistente.nacionalidade : 'Brasileiro(a)');
  const [rg, setRg] = useState(modoCompletarPerfil && usuarioExistente?.rg ? usuarioExistente.rg : '');
  const [nomeMae, setNomeMae] = useState(modoCompletarPerfil && usuarioExistente?.nomeMae ? usuarioExistente.nomeMae : '');
  const [nomePai, setNomePai] = useState(modoCompletarPerfil && usuarioExistente?.nomePai ? usuarioExistente.nomePai : '');

  const [enderecoCEP, setEnderecoCEP] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.cep ? usuarioExistente.endereco.cep : '');
  const [enderecoLogradouro, setEnderecoLogradouro] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.logradouro ? usuarioExistente.endereco.logradouro : '');
  const [enderecoNumero, setEnderecoNumero] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.numero ? usuarioExistente.endereco.numero : '');
  const [enderecoComplemento, setEnderecoComplemento] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.complemento ? usuarioExistente.endereco.complemento : '');
  const [enderecoBairro, setEnderecoBairro] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.bairro ? usuarioExistente.endereco.bairro : '');
  const [enderecoCidade, setEnderecoCidade] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.cidade ? usuarioExistente.endereco.cidade : '');
  const [enderecoUF, setEnderecoUF] = useState(modoCompletarPerfil && usuarioExistente?.endereco?.uf ? usuarioExistente.endereco.uf : (ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]));
  
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [cepStatus, setCepStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalCpfCnpjCliente, setOriginalCpfCnpjCliente] = useState('');
  const [originalCpfAdvogado, setOriginalCpfAdvogado] = useState('');

  // Máscaras
  const telefoneMask = '(00) 00000-0000';
  const cpfMask = '000.000.000-00';
  const cnpjMask = '00.000.000/0000-00';
  const cepMask = '00000-000';
  const dataMask = '00/00/0000';
  const rgMask = '00.000.000-A'; // Exemplo, pode variar e ser ajustado

  // Funções de Validação e CEP (useCallback)
  const handleCpfAdvogadoValidation = useCallback((currentCpf = cpfAdvogado) => {
    const cpfClean = String(currentCpf || '').replace(/\D/g, '');
    let localError = null;
    if (cpfClean.length === 0) { setCpfAdvogadoStatus('idle'); }
    else {
      const isValid = cpf.isValid(cpfClean);
      setCpfAdvogadoStatus(isValid ? 'valid' : 'invalid');
      if (!isValid && cpfClean.length === 11) { localError = "CPF do advogado inválido."; }
    }
    if (localError) { setError(localError); }
    else if (error && typeof error === 'string' && error.toLowerCase().includes('cpf do advogado')) { setError(null); }
  }, [cpfAdvogado, error, setError, setCpfAdvogadoStatus]);

  const handleCpfCnpjClienteValidation = useCallback((currentValue = cpfCnpjCliente, currentTipo = tipoPessoaCliente) => {
    const valorLimpo = String(currentValue || '').replace(/\D/g, '');
    let localError = null; let localStatus = 'idle';
    if (valorLimpo.length === 0) { localStatus = 'idle'; }
    else {
      const expectedLength = currentTipo === 'Pessoa Física' ? 11 : 14;
      let isValid = false;
      if (valorLimpo.length === expectedLength) {
        isValid = currentTipo === 'Pessoa Física' ? cpf.isValid(valorLimpo) : cnpj.isValid(valorLimpo);
        localStatus = isValid ? 'valid' : 'invalid';
        if (!isValid) localError = `Dígitos verificadores inválidos para ${currentTipo}.`;
      } else { localStatus = 'invalid'; localError = `Comprimento inválido para ${currentTipo}.`; }
    }
    setCpfCnpjClienteStatus(localStatus);
    const errorKey = currentTipo.toLowerCase().replace('pessoa ', '');
    if (localError) { setError(localError); }
    else if (error && typeof error === 'string' && error.toLowerCase().includes(errorKey)) { setError(null); }
  }, [cpfCnpjCliente, tipoPessoaCliente, error, setError, setCpfCnpjClienteStatus]);

  const handleCepBlurCliente = useCallback(async (currentCep = enderecoCEP) => {
    const cepLimpo = String(currentCep || '').replace(/\D/g, '');
    if (error && typeof error === 'string' && error.toLowerCase().includes('cep')) setError(null);
    if (cepLimpo.length === 0) { setCepStatus('idle'); setEnderecoLogradouro(''); setEnderecoBairro(''); setEnderecoCidade(''); setEnderecoUF(ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]); return; }
    if (cepLimpo.length !== 8) { setError("CEP incompleto. Deve conter 8 dígitos."); setCepStatus('invalid'); return; }
    setLoadingCEP(true); setCepStatus('idle');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (!response.ok) throw new Error(`Erro ViaCEP: ${response.status}`);
      const data = await response.json();
      if (data.erro) {
        setError("CEP não encontrado ou inválido."); setCepStatus('invalid');
        setEnderecoLogradouro(''); setEnderecoBairro(''); setEnderecoCidade(''); setEnderecoUF(ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
      } else {
        setEnderecoLogradouro(data.logradouro || ''); setEnderecoBairro(data.bairro || '');
        setEnderecoCidade(data.localidade || ''); setEnderecoUF(data.uf || ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]);
        setCepStatus('valid');
        const numeroField = document.getElementById("signup-enderecoNumeroCliente");
        if (numeroField) numeroField.focus();
      }
    } catch (err) { console.error("Erro CEP:", err); setError("Erro ao buscar informações do CEP."); setCepStatus('invalid'); }
    finally { setLoadingCEP(false); }
  }, [enderecoCEP, error, setError, setCepStatus, setEnderecoLogradouro, setEnderecoBairro, setEnderecoCidade, setEnderecoUF]);
  
  // Efeito para pré-preenchimento
  useEffect(() => {
    if (modoCompletarPerfil && usuarioExistente) {
      if (usuarioExistente.papel && usuarioExistente.papel !== 'precisaCompletarCadastro') {
        setPapelSelecionado(usuarioExistente.papel); setEtapaCadastro(2);
      } else { setEtapaCadastro(1); }
      setNome(usuarioExistente.nome || ''); setEmail(usuarioExistente.email || '');
      setTelefone(usuarioExistente.telefone || '');
      
      if (usuarioExistente.papel === 'advogado' || (papelSelecionado === 'advogado' && modoCompletarPerfil)) {
        setOab(usuarioExistente.oab || '');
        const currentCpfAdv = usuarioExistente.cpfAdvogado || ''; setCpfAdvogado(currentCpfAdv);
        setOriginalCpfAdvogado(currentCpfAdv);
        if (currentCpfAdv.replace(/\D/g, '').length > 0) handleCpfAdvogadoValidation(currentCpfAdv);
      }
      if (usuarioExistente.papel === 'cliente' || (papelSelecionado === 'cliente' && modoCompletarPerfil)) {
        const currentTipoPessoaCli = usuarioExistente.tipoPessoaCliente || tiposPessoaClienteOptions[0];
        setTipoPessoaCliente(currentTipoPessoaCli);
        const currentCpfCnpjCli = usuarioExistente.cpfCnpjCliente || '';
        setCpfCnpjCliente(currentCpfCnpjCli); setOriginalCpfCnpjCliente(currentCpfCnpjCli);
        if (currentCpfCnpjCli.replace(/\D/g, '').length > 0) handleCpfCnpjClienteValidation(currentCpfCnpjCli, currentTipoPessoaCli);
        
        setDataNascimento(usuarioExistente.dataNascimento || '');
        setEstadoCivil(usuarioExistente.estadoCivil || '');
        setProfissao(usuarioExistente.profissao || '');
        setNacionalidade(usuarioExistente.nacionalidade || 'Brasileiro(a)');
        setRg(usuarioExistente.rg || '');
        setNomeMae(usuarioExistente.nomeMae || '');
        setNomePai(usuarioExistente.nomePai || '');

        if (usuarioExistente.endereco) {
            const currentCep = usuarioExistente.endereco.cep || ''; setEnderecoCEP(currentCep);
            setEnderecoLogradouro(usuarioExistente.endereco.logradouro || '');
            setEnderecoNumero(usuarioExistente.endereco.numero || '');
            setEnderecoComplemento(usuarioExistente.endereco.complemento || '');
            setEnderecoBairro(usuarioExistente.endereco.bairro || '');
            setEnderecoCidade(usuarioExistente.endereco.cidade || '');
            setEnderecoUF(usuarioExistente.endereco.uf || (ufsBrasil.includes("SP") ? "SP" : ufsBrasil[0]));
            if(currentCep.replace(/\D/g, '').length === 8) handleCepBlurCliente(currentCep);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoCompletarPerfil, usuarioExistente, papelSelecionado]);


  useEffect(() => {
    let timer; if (success) { timer = setTimeout(() => { setSuccess(''); }, 4500); }
    return () => clearTimeout(timer);
  }, [success]);

  const handleSelectRole = (papel) => { setPapelSelecionado(papel); setEtapaCadastro(2); setError(null); setSuccess(''); };
  const handleVoltarEtapa = () => { setEtapaCadastro(1); setError(null); setSuccess(''); };

  const validateForm = () => {
    setError(null);
    if (!modoCompletarPerfil && (password.length < 6 || password !== confirmPassword)) { 
        if (password.length < 6 && password !== "") { setError("A senha deve ter no mínimo 6 caracteres."); return false;}
        else if (password !== confirmPassword) { setError("As senhas não coincidem."); return false; }
    }
    if (!nome.trim()) { setError("Nome completo é obrigatório."); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) { setError("E-mail inválido."); return false; }
    
    // Telefone agora é obrigatório
    if (!telefone.trim()) { setError("Telefone é obrigatório."); return false; }
    if (telefone.replace(/\D/g, '').length < 10) { setError("Telefone parece incompleto (mínimo 10 dígitos)."); return false; }

    if (papelSelecionado === 'advogado') {
      if (oab.trim() && oab.trim().length < 3) { setError("Número da OAB parece inválido."); return false; }
      const cpfClean = cpfAdvogado.replace(/\D/g, '');
      if (cpfClean.length > 0) {
        if (cpfAdvogadoStatus !== 'valid') { setError("CPF do advogado inválido ou não verificado."); return false; }
      }
    } else if (papelSelecionado === 'cliente') {
      const cpfCnpjClean = cpfCnpjCliente.replace(/\D/g, '');
      if (cpfCnpjClean.length === 0) { setError(`${tipoPessoaCliente} é obrigatório.`); return false; } // CPF/CNPJ Cliente obrigatório
      if (cpfCnpjClienteStatus !== 'valid') { setError(`${tipoPessoaCliente} do cliente inválido ou não verificado.`); return false; }
      
      // Validação dos novos campos (obrigatórios como exemplo)
      if (!dataNascimento.trim()) { setError("Data de nascimento é obrigatória."); return false; }
      const dataNascParts = dataNascimento.split('/');
      if (dataNascParts.length === 3) {
        const dia = parseInt(dataNascParts[0], 10);
        const mes = parseInt(dataNascParts[1], 10);
        const ano = parseInt(dataNascParts[2], 10);
        if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) {
            setError("Data de nascimento inválida."); return false;
        }
      } else if (dataNascimento.trim()) { // Se algo foi digitado mas não tem 3 partes
         setError("Formato da data de nascimento inválido (DD/MM/AAAA)."); return false;
      }

      if (!estadoCivil) { setError("Estado civil é obrigatório."); return false; }
      if (!profissao.trim()) { setError("Profissão é obrigatória."); return false; }
      if (!nacionalidade.trim()) { setError("Nacionalidade é obrigatória."); return false; }
      // RG é opcional
      // Nome da Mãe e Pai são opcionais

      const cepClean = enderecoCEP.replace(/\D/g, '');
      if (cepClean.length > 0 && cepClean.length < 8 ) { setError("CEP incompleto."); setCepStatus('invalid'); return false; }
      if (cepClean.length === 8 && cepStatus !== 'valid') { setError("CEP inválido ou busca pendente. Verifique e aguarde."); return false; }
      
      if (cepStatus === 'valid') { // Endereço obrigatório se CEP validado
        if (!enderecoLogradouro.trim()) { setError("Logradouro é obrigatório após busca de CEP."); return false; }
        if (!enderecoNumero.trim()) { setError("Número do endereço é obrigatório."); return false; }
        if (!enderecoBairro.trim()) { setError("Bairro é obrigatório após busca de CEP."); return false; }
        if (!enderecoCidade.trim()) { setError("Cidade é obrigatória após busca de CEP."); return false; }
        if (!enderecoUF.trim()) { setError("UF é obrigatório após busca de CEP."); return false; }
      }
    }
    return true;
  };

  const handleSubmitCadastro = async (event) => {
    if (event) event.preventDefault();
    if (papelSelecionado === 'advogado' && cpfAdvogado.trim().length > 0) handleCpfAdvogadoValidation();
    if (papelSelecionado === 'cliente' && cpfCnpjCliente.trim().length > 0) handleCpfCnpjClienteValidation(cpfCnpjCliente, tipoPessoaCliente);
    if (papelSelecionado === 'cliente' && enderecoCEP.replace(/\D/g, '').length === 8 && cepStatus === 'idle' && !loadingCEP) {
      await handleCepBlurCliente();
    }

    if (!validateForm()) { window.scrollTo(0, 0); return; }
    setIsSubmitting(true); setSuccess(''); setError(null);
    try {
      let userToProcess = auth.currentUser;
      let isNewUserCreation = false;
      if (!modoCompletarPerfil) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        userToProcess = userCredential.user; isNewUserCreation = true;
      } else if (!userToProcess && usuarioExistente?.uid) {
        userToProcess = { uid: usuarioExistente.uid, email: usuarioExistente.email, emailVerified: usuarioExistente.emailVerified || false };
      } else if (!userToProcess) { throw new Error("Usuário não autenticado para completar o perfil."); }

      const dadosUsuario = {
        uid: userToProcess.uid, nome: nome.trim(), email: userToProcess.email,
        telefone: telefone, papel: papelSelecionado,
        criadoEm: modoCompletarPerfil && usuarioExistente?.criadoEm ? usuarioExistente.criadoEm : Timestamp.now(),
        atualizadoEm: Timestamp.now(),
        emailVerificado: userToProcess.emailVerified !== undefined ? userToProcess.emailVerified : false,
      };

      if (papelSelecionado === 'advogado') {
        if (oab.trim()) dadosUsuario.oab = oab.trim().toUpperCase();
        if (cpfAdvogado.trim()) {
          dadosUsuario.cpfAdvogado = cpfAdvogado;
          if (cpfAdvogado.trim() && (!modoCompletarPerfil || cpfAdvogado !== originalCpfAdvogado)) {
            const qCpfAdv = query(collection(db, "usuarios"), where("papel", "==", "advogado"), where("cpfAdvogado", "==", cpfAdvogado));
            const CpfAdvSnapshot = await getDocs(qCpfAdv);
            let conflitoReal = false; CpfAdvSnapshot.forEach(docFound => { if(docFound.id !== userToProcess.uid) conflitoReal = true; });
            if(conflitoReal){ setError("Este CPF de advogado já está cadastrado."); setIsSubmitting(false); return; }
          }
        }
      } else if (papelSelecionado === 'cliente') {
        dadosUsuario.tipoPessoaCliente = tipoPessoaCliente;
        const cpfCnpjClienteLimpo = cpfCnpjCliente.replace(/\D/g, '');
        if (cpfCnpjCliente.trim()) {
          dadosUsuario.cpfCnpjCliente = cpfCnpjCliente; dadosUsuario.cpfCnpjClienteNumerico = cpfCnpjClienteLimpo;
           if (cpfCnpjClienteLimpo.length > 0 && (!modoCompletarPerfil || cpfCnpjCliente !== originalCpfCnpjCliente)) {
            const qCpfCnpjCli = query(collection(db, "usuarios"), where("papel", "==", "cliente"), where("cpfCnpjClienteNumerico", "==", cpfCnpjClienteLimpo));
            const CpfCnpjCliSnapshot = await getDocs(qCpfCnpjCli);
             let conflitoReal = false; CpfCnpjCliSnapshot.forEach(docFound => { if(docFound.id !== userToProcess.uid) conflitoReal = true; });
             if(conflitoReal){ setError(`Este ${tipoPessoaCliente} de cliente já está cadastrado.`); setIsSubmitting(false); return; }
           }
        }
        // Salvar novos dados pessoais do cliente
        dadosUsuario.dataNascimento = dataNascimento || null; // Salva null se vazio
        dadosUsuario.estadoCivil = estadoCivil || null;
        dadosUsuario.profissao = profissao.trim() || null;
        dadosUsuario.nacionalidade = nacionalidade.trim() || null;
        dadosUsuario.rg = rg.trim() || null;
        dadosUsuario.nomeMae = nomeMae.trim() || null;
        dadosUsuario.nomePai = nomePai.trim() || null;

        if (enderecoCEP.replace(/\D/g, '').length === 8 && cepStatus === 'valid') {
            dadosUsuario.endereco = { cep: enderecoCEP, logradouro: enderecoLogradouro, numero: enderecoNumero, complemento: enderecoComplemento, bairro: enderecoBairro, cidade: enderecoCidade, uf: enderecoUF, };
        } else if (enderecoCEP.replace(/\D/g, '').length > 0 && cepStatus !== 'valid') { setError("Verifique o CEP antes de salvar."); setIsSubmitting(false); return; }
      }
      await setDoc(doc(db, "usuarios", userToProcess.uid), dadosUsuario, { merge: true });
      
      if (isNewUserCreation) {
        await sendEmailVerification(userToProcess);
        setSuccess('Cadastro realizado! Verifique seu e-mail para ativar sua conta.');
      } else { 
        setSuccess('Perfil atualizado com sucesso!');
        if(onProfileCompleted) onProfileCompleted(); // Chama o callback do App.js
      }
      
      if (!modoCompletarPerfil) {
          setNome(''); setEmail(''); setPassword(''); setConfirmPassword(''); setTelefone('');
          setOab(''); setCpfAdvogado(''); setCpfAdvogadoStatus('idle');
          setTipoPessoaCliente(tiposPessoaClienteOptions[0]); setCpfCnpjCliente(''); setCpfCnpjClienteStatus('idle');
          setDataNascimento(''); setEstadoCivil(''); setProfissao(''); setNacionalidade('Brasileiro(a)'); setRg(''); setNomeMae(''); setNomePai('');
          setEnderecoCEP(''); setEnderecoLogradouro(''); setEnderecoNumero(''); setEnderecoComplemento('');
          setEnderecoBairro(''); setEnderecoCidade(''); setEnderecoUF(ufsBrasil[0]); setCepStatus('idle');
      }
      setTimeout(() => {
        setSuccess('');
        if (modoCompletarPerfil) { /* A navegação é feita pelo onProfileCompleted no App.js */ }
        else { onSwitchMode('login'); }
      }, modoCompletarPerfil ? 1500 : 3000); // Reduzido tempo para perfil completo
    } catch (err) {
      console.error("SignUp.js: Erro no cadastro:", err);
      let errorMessage = 'Erro ao realizar o cadastro.';
      if (err && typeof err === 'object') {
        const errCode = err.code; const errMessage = err.message;
        if (errCode === 'auth/email-already-in-use') { errorMessage = 'Este e-mail já está em uso.'; }
        else if (errCode === 'auth/weak-password') { errorMessage = 'Senha fraca (mínimo 6 caracteres).'; }
        else if (errMessage) { errorMessage = errMessage; }
      }
      setError(errorMessage);
    } finally { setIsSubmitting(false); }
  };

  // --- Renderização ---
  if (etapaCadastro === 1) {
    return (
      <div className="auth-form-content etapa-selecao-papel">
        <h2>Como você usará a plataforma?</h2>
        <p className="auth-form-subtitle">Selecione seu perfil para começarmos.</p>
        <div className="papeis-container">
          <button type="button" className="papel-card" onClick={() => handleSelectRole('advogado')}><AdvogadoIcon /><h3>Sou Advogado</h3><p>Quero gerenciar casos, clientes e agenda.</p></button>
          <button type="button" className="papel-card" onClick={() => handleSelectRole('cliente')}><ClienteIcon /><h3>Sou Cliente</h3><p>Preciso de assistência ou quero acompanhar meu caso.</p></button>
        </div>
        <div className="auth-switch-link">
          {!modoCompletarPerfil && (<>Já possui uma conta?{' '}<button type="button" onClick={() => onSwitchMode('login')} className="link-button">Faça login</button></>)}
        </div>
      </div>
    );
  }

  // Etapa 2: Formulário de Dados
  return (
    <div className="auth-form-content">
      {!modoCompletarPerfil && etapaCadastro === 2 && (
          <button type="button" onClick={handleVoltarEtapa} className="link-button link-voltar">&#8592; Voltar para seleção de perfil</button>
      )}
      <h2>{modoCompletarPerfil ? 'Complete Seu Cadastro' : `Cadastro de ${papelSelecionado === 'advogado' ? 'Advogado' : 'Cliente'}`}</h2>
      <form onSubmit={handleSubmitCadastro}>
        <div className="form-grid">
          <div className="form-group full-width"><label htmlFor="signup-nome">Nome Completo: *</label><input type="text" id="signup-nome" value={nome} onChange={(e) => setNome(e.target.value)} required disabled={isSubmitting}/></div>
          <div className="form-group full-width"><label htmlFor="signup-email">Email: *</label><input type="email" id="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting || modoCompletarPerfil}/></div>
          <div className="form-group"><label htmlFor="signup-telefone">Telefone: *</label><IMaskInput mask={telefoneMask} value={telefone} onAccept={(v) => setTelefone(v)} id="signup-telefone" required disabled={isSubmitting} placeholder="(XX) XXXXX-XXXX"/></div>
          
          {papelSelecionado === 'advogado' && (
            <>
              <div className="form-group"><label htmlFor="signup-oab">OAB (Ex: SP123456):</label><input type="text" id="signup-oab" value={oab} onChange={(e) => setOab(e.target.value)} disabled={isSubmitting} placeholder="UF e Número"/></div>
              <div className="form-group"><label htmlFor="signup-cpf-advogado">CPF (Advogado - Opcional):</label><div className={`input-with-validation ${cpfAdvogadoStatus}`}><IMaskInput mask={cpfMask} lazy={true} placeholderChar=" " value={cpfAdvogado} onAccept={(v) => {setCpfAdvogado(v); setCpfAdvogadoStatus('idle'); if(error && typeof error ==='string' && error.includes('CPF do adv')) setError(null);}} onBlur={() => handleCpfAdvogadoValidation()} id="signup-cpf-advogado" disabled={isSubmitting} placeholder="___.___.___-__"/>{cpfAdvogadoStatus === 'valid' && <ValidIcon />}{cpfAdvogadoStatus === 'invalid' && <InvalidIcon />}</div></div>
               {/* Espaçador para manter o grid alinhado se este for o último campo da linha */}
               <div className="form-group"></div>
            </>
          )}

          {papelSelecionado === 'cliente' && (
            <>
              <div className="form-group">
                <label htmlFor="signup-tipoPessoaCliente">Você é: *</label>
                <select id="signup-tipoPessoaCliente" value={tipoPessoaCliente} onChange={(e) => {setTipoPessoaCliente(e.target.value); setCpfCnpjCliente(''); setCpfCnpjClienteStatus('idle'); setError(null);}} disabled={isSubmitting} required>
                    {tiposPessoaClienteOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="signup-cpfCnpjCliente">{tipoPessoaCliente === 'Pessoa Física' ? 'CPF' : 'CNPJ'}: *</label>
                <div className={`input-with-validation ${cpfCnpjClienteStatus}`}><IMaskInput mask={tipoPessoaCliente === 'Pessoa Física' ? cpfMask : cnpjMask} lazy={true} placeholderChar=" " value={cpfCnpjCliente} onAccept={(value, maskRef) => { setCpfCnpjCliente(maskRef.value); setCpfCnpjClienteStatus('idle'); if(error && (typeof error ==='string' &&(error.toLowerCase().includes('cpf') || error.toLowerCase().includes('cnpj')))) setError(null);}} onBlur={() => handleCpfCnpjClienteValidation(cpfCnpjCliente, tipoPessoaCliente)} id="signup-cpfCnpjCliente" disabled={isSubmitting} placeholder={tipoPessoaCliente === 'Pessoa Física' ? '___.___.___-__' : '__.___.___/____-__'} key={tipoPessoaCliente} required/>
                  {!loadingCEP && cpfCnpjClienteStatus === 'valid' && <ValidIcon />}
                  {!loadingCEP && cpfCnpjClienteStatus === 'invalid' && <InvalidIcon />}
                </div>
              </div>
              
              <h3 className='form-section-title full-width'>Dados Pessoais Adicionais</h3>
              <div className="form-group">
                <label htmlFor="signup-dataNascimento">Data de Nascimento: *</label>
                <IMaskInput mask={dataMask} placeholder="DD/MM/AAAA" id="signup-dataNascimento" value={dataNascimento} onAccept={(v) => setDataNascimento(v)} disabled={isSubmitting} required />
              </div>
              <div className="form-group">
                <label htmlFor="signup-estadoCivil">Estado Civil: *</label>
                <select id="signup-estadoCivil" value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} required disabled={isSubmitting}>
                  {estadosCivisOptions.map(ec => <option key={ec} value={ec} disabled={ec === ""}>{ec === "" ? "-- Selecione --" : ec}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="signup-profissao">Profissão: *</label>
                <input type="text" id="signup-profissao" value={profissao} onChange={(e) => setProfissao(e.target.value)} required disabled={isSubmitting}/>
              </div>
              <div className="form-group">
                <label htmlFor="signup-nacionalidade">Nacionalidade: *</label>
                <input type="text" id="signup-nacionalidade" value={nacionalidade} onChange={(e) => setNacionalidade(e.target.value)} required disabled={isSubmitting}/>
              </div>
              <div className="form-group">
                <label htmlFor="signup-rg">RG (Opcional):</label>
                <IMaskInput mask={rgMask} placeholder="00.000.000-X" id="signup-rg" value={rg} onAccept={(v) => setRg(v)} disabled={isSubmitting}/>
              </div>
              <div className="form-group"> {/* Espaçador para alinhar grid */} </div>

              <div className="form-group full-width">
                <label htmlFor="signup-nomeMae">Nome da Mãe (Opcional):</label>
                <input type="text" id="signup-nomeMae" value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} disabled={isSubmitting}/>
              </div>
              <div className="form-group full-width">
                <label htmlFor="signup-nomePai">Nome do Pai (Opcional):</label>
                <input type="text" id="signup-nomePai" value={nomePai} onChange={(e) => setNomePai(e.target.value)} disabled={isSubmitting}/>
              </div>
              
              <h3 className='form-section-title full-width'>Endereço do Cliente</h3>
              <div className="form-group"><label htmlFor="signup-enderecoCEPCliente">CEP:</label><div className={`input-with-feedback ${loadingCEP ? '' : cepStatus}`}><IMaskInput mask={cepMask} value={enderecoCEP} onAccept={(v) => {setEnderecoCEP(v); setCepStatus('idle'); if(error && typeof error ==='string' && error.includes("CEP")) setError(null);}} onBlur={() => handleCepBlurCliente()} id="signup-enderecoCEPCliente" disabled={isSubmitting || loadingCEP} placeholder="_____-___"/>{loadingCEP && <span className="loading-cep-spinner"></span>}{!loadingCEP && cepStatus === 'valid' && <ValidIcon />}{!loadingCEP && cepStatus === 'invalid' && <InvalidIcon />}</div></div>
              <div className="form-group"></div>
              <div className="form-group full-width"><label htmlFor="signup-enderecoLogradouroCliente">Logradouro:</label><input type="text" id="signup-enderecoLogradouroCliente" value={enderecoLogradouro} onChange={(e) => setEnderecoLogradouro(e.target.value)} disabled={isSubmitting || loadingCEP} /></div>
              <div className="form-group"><label htmlFor="signup-enderecoNumeroCliente">Número:</label><input type="text" id="signup-enderecoNumeroCliente" value={enderecoNumero} onChange={(e) => setEnderecoNumero(e.target.value)} disabled={isSubmitting || loadingCEP} /></div>
              <div className="form-group"><label htmlFor="signup-enderecoComplementoCliente">Complemento:</label><input type="text" id="signup-enderecoComplementoCliente" value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} disabled={isSubmitting || loadingCEP} /></div>
              <div className="form-group"><label htmlFor="signup-enderecoBairroCliente">Bairro:</label><input type="text" id="signup-enderecoBairroCliente" value={enderecoBairro} onChange={(e) => setEnderecoBairro(e.target.value)} disabled={isSubmitting || loadingCEP} /></div>
              <div className="form-group"><label htmlFor="signup-enderecoCidadeCliente">Cidade:</label><input type="text" id="signup-enderecoCidadeCliente" value={enderecoCidade} onChange={(e) => setEnderecoCidade(e.target.value)} disabled={isSubmitting || loadingCEP} /></div>
              <div className="form-group"><label htmlFor="signup-enderecoUFCliente">UF:</label><select id="signup-enderecoUFCliente" value={enderecoUF} onChange={(e) => setEnderecoUF(e.target.value)} disabled={isSubmitting || loadingCEP}>{ufsBrasil.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></div>
              <div className="form-group"></div>
            </>
          )}

          {!modoCompletarPerfil && (
            <React.Fragment>
              <div className="form-group"><label htmlFor="signup-password">Nova Senha (mínimo 6 caracteres): *</label><input type="password" id="signup-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" disabled={isSubmitting}/></div>
              <div className="form-group"><label htmlFor="signup-confirm-password">Confirmar Nova Senha: *</label><input type="password" id="signup-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength="6" disabled={isSubmitting}/></div>
            </React.Fragment>
          )}
        </div>

        <button type="submit" className="button-primary" disabled={isSubmitting || loadingCEP}>
          {isSubmitting ? 'Salvando...' : (modoCompletarPerfil ? 'Salvar Perfil' : 'Finalizar Cadastro')}
        </button>
      </form>
      {error && <p className="auth-message error">{error}</p>}
      {success && <p className="auth-message success">{success}</p>}
      {!modoCompletarPerfil && (
          <div className="auth-switch-link">
            Já possui uma conta?{' '}
            <button type="button" onClick={() => onSwitchMode('login')} disabled={isSubmitting} className="link-button">Faça login</button>
          </div>
      )}
    </div>
  );
}
export default SignUp;