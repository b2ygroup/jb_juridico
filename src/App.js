import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from './firebaseConfig';

// Componentes Core e Auth
import SplashScreen from './SplashScreen';
import SidebarNav from './SidebarNav';
import Dashboard from './Dashboard';
import Login from './Login';
import SignUp from './SignUp';
import ForgotPassword from './ForgotPassword';

// Componentes de Processos
import ProcessosListPage from './ProcessosListPage';
import ProcessoDetalhePage from './ProcessoDetalhePage';
import NovoProcessoPage from './NovoProcessoPage';
import EditarProcessoPage from './EditarProcessoPage';

// Componentes de Clientes
import ClientesListPage from './ClientesListPage';
import NovoClientePage from './NovoClientePage';
import ClienteDetalhePage from './ClienteDetalhePage';
import EditarClientePage from './EditarClientePage';

// Componentes da Agenda
import NovaTarefaPage from './NovaTarefaPage';
import AgendaListPage from './AgendaListPage';
import EditarTarefaPage from './EditarTarefaPage';

// Componente Assistente IA
import AssistenteIAPage from './AssistenteIAPage';

// Componentes do Portal do Cliente
import PortalClienteHomePage from './PortalClienteHomePage';
import NovaOcorrenciaPage from './NovaOcorrenciaPage';

// Ocorrências (Advogado)
import OcorrenciaDetalhePageAdv from './OcorrenciaDetalhePageAdv';
import OcorrenciasListPage from './OcorrenciasListPage'; 




import './App.css';
import './AuthForms.css';

const PlusIcon = () => <>&#43;</>;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const navigate = useNavigate();

  const fetchAndSetUser = useCallback(async (userAuthParam) => {
    if (userAuthParam) {
      const userDocRef = doc(db, "usuarios", userAuthParam.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        let userDataToSet;
        if (docSnap.exists()) {
          const firestoreData = docSnap.data();
          const papelUsuario = firestoreData.papel;
          if (papelUsuario === 'advogado' || papelUsuario === 'cliente') {
            userDataToSet = {
              uid: userAuthParam.uid, email: userAuthParam.email, emailVerificado: userAuthParam.emailVerified,
              nome: firestoreData.nome, papel: papelUsuario,
              oab: firestoreData.oab, cpfAdvogado: firestoreData.cpfAdvogado,
              tipoPessoaCliente: firestoreData.tipoPessoaCliente,
              cpfCnpjCliente: firestoreData.cpfCnpjCliente,
              endereco: firestoreData.endereco,
            };
            setCurrentUser(prevUser => JSON.stringify(prevUser) !== JSON.stringify(userDataToSet) ? userDataToSet : prevUser);
            if (window.location.pathname === '/auth' || window.location.pathname === '/completar-cadastro') {
              navigate(papelUsuario === 'advogado' ? '/' : '/portal-cliente', { replace: true });
            }
          } else {
            console.warn(`Usuário ${userAuthParam.uid} com perfil Firestore, mas papel inválido: '${papelUsuario}'. Marcando para completar.`);
            userDataToSet = {
              uid: userAuthParam.uid, email: userAuthParam.email, emailVerificado: userAuthParam.emailVerified,
              nome: firestoreData.nome || userAuthParam.displayName || '', papel: 'precisaCompletarCadastro'
            };
            setCurrentUser(userDataToSet);
            if (window.location.pathname !== '/completar-cadastro') {
              navigate('/completar-cadastro', { replace: true });
            }
          }
        } else {
          console.warn("Usuário autenticado sem perfil no Firestore:", userAuthParam.uid, ". Marcando para completar cadastro.");
          userDataToSet = {
            uid: userAuthParam.uid, email: userAuthParam.email, emailVerificado: userAuthParam.emailVerified,
            nome: userAuthParam.displayName || '', papel: 'precisaCompletarCadastro'
          };
          setCurrentUser(userDataToSet);
          if (window.location.pathname !== '/completar-cadastro') {
             navigate('/completar-cadastro', { replace: true });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar/definir perfil do usuário:", error);
        setCurrentUser({
          uid: userAuthParam.uid, email: userAuthParam.email, emailVerificado: userAuthParam.emailVerified,
          nome: userAuthParam.displayName || '', papel: 'precisaCompletarCadastro'
        });
        if (window.location.pathname !== '/completar-cadastro') {
            navigate('/completar-cadastro', { replace: true });
        }
      }
    } else {
      setCurrentUser(null);
    }
    setLoadingAuth(false);
  }, [navigate]);

  useEffect(() => {
    const splashTimerDuration = 6500; // Ajuste conforme necessário
    const splashTimer = setTimeout(() => { setShowSplash(false); }, splashTimerDuration);
    const unsubscribeAuth = onAuthStateChanged(auth, fetchAndSetUser);
    return () => { clearTimeout(splashTimer); unsubscribeAuth(); };
  }, [fetchAndSetUser]);

  const handleLogoutCallback = useCallback(async () => {
    await signOut(auth);
    setAuthMode('login');
  }, []);

  const handleProfileCompleted = useCallback(async () => {
    if (auth.currentUser) {
      setLoadingAuth(true);
      await fetchAndSetUser(auth.currentUser);
    } else {
      setLoadingAuth(false);
      navigate('/auth', { replace: true });
    }
  }, [fetchAndSetUser, navigate]);

  const ProtectedRoute = ({ children, paraPapel }) => {
    if (loadingAuth && !showSplash) { return <div className="App-container loading-app"><p>Verificando autenticação...</p></div>; }
    if (!loadingAuth && !currentUser) { return <Navigate to="/auth" replace />; }

    if (currentUser) {
      if (currentUser.papel === 'precisaCompletarCadastro' && window.location.pathname !== '/completar-cadastro' && window.location.pathname !== '/auth') {
         return <Navigate to="/completar-cadastro" replace />;
      }
      if (paraPapel && currentUser.papel !== paraPapel && currentUser.papel !== 'precisaCompletarCadastro') {
        const targetPath = currentUser.papel === 'advogado' ? '/' : (currentUser.papel === 'cliente' ? '/portal-cliente' : '/auth');
        return <Navigate to={targetPath} replace />;
      }
      if ( (paraPapel && currentUser.papel === paraPapel && currentUser.papel !== 'precisaCompletarCadastro') ||
           (!paraPapel && currentUser.papel !== 'precisaCompletarCadastro') ||
           (currentUser.papel === 'precisaCompletarCadastro' && window.location.pathname === '/completar-cadastro') ) {
        return children;
      }
    }
    return <Navigate to="/auth" replace />;
  };

  const DashboardLayoutAdvogado = ({ children }) => {
    const userDisplayName = currentUser?.nome || currentUser?.email || 'Advogado';
    return (
      <div className="dashboard-layout">
        <SidebarNav />
        <div className="dashboard-main-content">
          <header className="dashboard-header">
            <div className="header-actions">
              <Link to="/processos/novo" className="button-quick-action-header"><PlusIcon /> Novo Processo</Link>
              <Link to="/clientes/novo" className="button-quick-action-header"><PlusIcon /> Novo Cliente</Link>
            </div>
            <div className="user-info"><span>Bem-vindo, {userDisplayName}!</span><button onClick={handleLogoutCallback} className="button-logout">Sair</button></div>
          </header>
          <main className="dashboard-content-area">{children}</main>
        </div>
      </div>
    );
  };

  const PortalClienteLayout = ({ children }) => {
    const userDisplayName = currentUser?.nome || currentUser?.email || 'Cliente';
    return (
      <div className="portal-cliente-layout">
        <header className="portal-cliente-header">
          <h2>Portal do Cliente - JB Jurídica</h2>
          <div className="user-info"><span>Olá, {userDisplayName}!</span><button onClick={handleLogoutCallback} className="button-logout">Sair</button></div>
        </header>
        <main className="portal-cliente-content-area">{children}</main>
        <footer className="portal-cliente-footer"><p>&copy; {new Date().getFullYear()} JB Inteligência Jurídica.</p></footer>
      </div>
    );
  };

  if (showSplash) { return <SplashScreen />; }
  if (loadingAuth) { return <div className="App-container loading-app"><p>Carregando aplicação...</p></div>; }

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          currentUser && currentUser.papel !== 'precisaCompletarCadastro' ?
            (currentUser.papel === 'advogado' ? <Navigate to="/" replace /> :
             currentUser.papel === 'cliente' ? <Navigate to="/portal-cliente" replace /> :
             <Navigate to="/auth" replace />
            )
          : (
            <div className="auth-page-container-refeito">
              <div className="auth-wrapper-refeito">
                <div className="auth-branding-top"><div className="auth-logo-text-top">JB</div><h2>Inteligência Jurídica em Ação</h2></div>
                <div className="auth-forms-area-refeito">
                  {authMode === 'login' && <Login onSwitchMode={setAuthMode} />}
                  {authMode === 'signup' && <SignUp onSwitchMode={setAuthMode} />}
                  {authMode === 'forgotPassword' && <ForgotPassword onSwitchMode={setAuthMode} />}
                </div>
              </div>
            </div>
          )
        }
      />
      <Route
        path="/completar-cadastro"
        element={
          (!currentUser || (currentUser.papel !== 'precisaCompletarCadastro' && currentUser.papel !== 'desconhecido')) ?
            <Navigate to={currentUser ? (currentUser.papel === 'advogado' ? "/" : "/portal-cliente") : "/auth"} replace />
          :
          <div className="auth-page-container-refeito">
            <div className="auth-wrapper-refeito">
              <div className="auth-branding-top"><div className="auth-logo-text-top">JB</div><h2>Complete Seu Cadastro</h2></div>
              <div className="auth-forms-area-refeito">
                   <SignUp
                      onSwitchMode={setAuthMode}
                      modoCompletarPerfil={true}
                      usuarioExistente={currentUser}
                      onProfileCompleted={handleProfileCompleted}
                   />
              </div>
            </div>
          </div>
        }
      />

      {/* --- ROTAS DO ADVOGADO --- */}
      <Route path="/" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><Dashboard /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/processos" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><ProcessosListPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/processos/novo" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><NovoProcessoPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/processos/:idProcesso" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><ProcessoDetalhePage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/processos/:idProcesso/editar" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><EditarProcessoPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><ClientesListPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/clientes/novo" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><NovoClientePage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/clientes/:idCliente" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><ClienteDetalhePage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/clientes/:idCliente/editar" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><EditarClientePage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><AgendaListPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/agenda/novo" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><NovaTarefaPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/agenda/:idTarefa/editar" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><EditarTarefaPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/assistente-ia" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><AssistenteIAPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      
      {/* NOVAS ROTAS PARA OCORRÊNCIAS (ADVOGADO) */}
      <Route path="/ocorrencias" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><OcorrenciasListPage /></DashboardLayoutAdvogado></ProtectedRoute>} />
      <Route path="/ocorrencias/:idOcorrencia" element={<ProtectedRoute paraPapel="advogado"><DashboardLayoutAdvogado><OcorrenciaDetalhePageAdv /></DashboardLayoutAdvogado></ProtectedRoute>} />

      {/* --- ROTAS DO PORTAL DO CLIENTE --- */}
      <Route path="/portal-cliente" element={<ProtectedRoute paraPapel="cliente"><PortalClienteLayout><PortalClienteHomePage /></PortalClienteLayout></ProtectedRoute>} />
      <Route path="/portal-cliente/nova-ocorrencia" element={<ProtectedRoute paraPapel="cliente"><PortalClienteLayout><NovaOcorrenciaPage /></PortalClienteLayout></ProtectedRoute>} />

      {/* Rota Fallback */}
      <Route path="*" element={
          !loadingAuth && currentUser ?
            (currentUser.papel === 'advogado' ? <Navigate to="/" replace /> :
             currentUser.papel === 'cliente' ? <Navigate to="/portal-cliente" replace /> :
             (currentUser.papel === 'precisaCompletarCadastro' || currentUser.papel === 'desconhecido') ? <Navigate to="/completar-cadastro" replace /> :
             <Navigate to="/auth" replace />
            )
            : <Navigate to="/auth" replace />
        }
      />
    </Routes>
  );
}
export default App;