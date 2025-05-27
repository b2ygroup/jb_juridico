import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, getCountFromServer } from "firebase/firestore";
import { db, auth } from './firebaseConfig';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import './Dashboard.css';

// Ícones
const FolderIcon = () => <span className="dash-icon-title">&#128193;</span>;
const CalendarIcon = () => <span className="dash-icon-title">&#128197;</span>;
const ChartIcon = () => <span className="dash-icon-title">&#128200;</span>;
const AssistenteIAIcon = () => <span className="dash-icon-title" style={{fontSize: '1.3em'}}>&#129302;</span>;
const ArrowRightIcon = () => <span className="arrow-icon">&#8594;</span>;
const InboxIcon = () => <span className="dash-icon-title">&#128230;</span>; // Ícone para novas ocorrências

// Função formatDate
const formatDate = (timestamp, includeTime = false) => {
  let dateObject = null;
  if (timestamp instanceof Timestamp) { dateObject = timestamp.toDate(); }
  else if (timestamp instanceof Date) { dateObject = timestamp; }
  if (dateObject) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) {
      // @ts-ignore
      options.hour = '2-digit';
      // @ts-ignore
      options.minute = '2-digit';
    }
    return dateObject.toLocaleString('pt-BR', options);
  }
  return '-';
};

const KPI_COLORS = ['var(--cor-acento)', '#00C49F', '#FFBB28', '#FF8042'];

function Dashboard() {
  const navigate = useNavigate();
  // Estados para dados existentes
  const [recentProcesses, setRecentProcesses] = useState([]);
  const [loadingProcesses, setLoadingProcesses] = useState(true);
  const [agendaSemana, setAgendaSemana] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [kpiProcessosAtivos, setKpiProcessosAtivos] = useState(0);
  const [kpiPrazosProximos, setKpiPrazosProximos] = useState(0);
  const [kpiTotalClientes, setKpiTotalClientes] = useState(0);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Novos estados para Ocorrências
  const [novasOcorrencias, setNovasOcorrencias] = useState([]);
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(true);
  const [errorOcorrencias, setErrorOcorrencias] = useState(null);


  const currentUser = auth.currentUser; // Pega o usuário do Auth diretamente (pode ser null inicialmente)

  // useEffect para buscar Processos Recentes
  useEffect(() => {
    if (currentUser && currentUser.uid) { // Verifica se currentUser e uid existem
        setLoadingProcesses(true);
        const qProc = query(collection(db, "processos"), where("userId", "==", currentUser.uid), orderBy("atualizadoEm", "desc"), limit(4));
        const unsubProcesses = onSnapshot(qProc, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentProcesses(data); setLoadingProcesses(false);
        }, (err) => { console.error("Processos Recentes Erro:", err); setLoadingProcesses(false); });
        return () => unsubProcesses();
    } else {
        setLoadingProcesses(false);
        setRecentProcesses([]);
    }
  }, [currentUser]);

  // useEffect para buscar Agenda da Semana
  useEffect(() => {
    if (currentUser && currentUser.uid) {
        setLoadingAgenda(true);
        const hoje = new Date();
        const inicioSemana = new Date(hoje); inicioSemana.setHours(0,0,0,0);
        const fimSemana = new Date(hoje); fimSemana.setDate(hoje.getDate() + 7); fimSemana.setHours(23,59,59,999);
        const qAgenda = query( collection(db, "agendaItens"), where("userId", "==", currentUser.uid),
        where("dataHoraInicio", ">=", Timestamp.fromDate(inicioSemana)),
        where("dataHoraInicio", "<=", Timestamp.fromDate(fimSemana)),
        orderBy("dataHoraInicio", "asc"), limit(4)
        );
        const unsubAgenda = onSnapshot(qAgenda, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAgendaSemana(data); setLoadingAgenda(false);
        }, (err) => { console.error("Agenda Semana Erro:", err); setLoadingAgenda(false); });
        return () => unsubAgenda();
    } else {
        setLoadingAgenda(false);
        setAgendaSemana([]);
    }
  }, [currentUser]);

  // useEffect para buscar KPIs
  useEffect(() => {
    if (currentUser && currentUser.uid) {
        setLoadingKpis(true);
        const fetchKpis = async () => {
        try {
            const statusAtivos = ["Novo", "Em Andamento", "Suspenso", "Aguardando Documentos", "Pendente Análise"];
            const qAtivos = query(collection(db, "processos"), where("userId", "==", currentUser.uid), where("status", "in", statusAtivos));
            const snapAtivos = await getCountFromServer(qAtivos);
            setKpiProcessosAtivos(snapAtivos.data().count);

            const hojeInicioKPI = new Date(); hojeInicioKPI.setHours(0, 0, 0, 0);
            const daqui7DiasFimKPI = new Date(); daqui7DiasFimKPI.setDate(hojeInicioKPI.getDate() + 7); daqui7DiasFimKPI.setHours(23, 59, 59, 999);
            const qPrazos = query( collection(db, "agendaItens"), where("userId", "==", currentUser.uid), where("tipo", "==", "Prazo"),
            where("status", "==", "Pendente"), where("dataHoraInicio", ">=", Timestamp.fromDate(hojeInicioKPI)),
            where("dataHoraInicio", "<=", Timestamp.fromDate(daqui7DiasFimKPI))
            );
            const snapPrazos = await getCountFromServer(qPrazos);
            setKpiPrazosProximos(snapPrazos.data().count);

            const qClientes = query(collection(db, "clientes"), where("userId", "==", currentUser.uid));
            const snapClientes = await getCountFromServer(qClientes);
            setKpiTotalClientes(snapClientes.data().count);
        } catch (error) {
            console.error("Dashboard KPIs Erro:", error);
            setKpiProcessosAtivos(0); setKpiPrazosProximos(0); setKpiTotalClientes(0);
            if (error && typeof error === 'object' && 'code' in error && error.code === 'failed-precondition') {
                alert("Índice do Firestore necessário para KPIs. Verifique o console (F12).");
            }
        } finally { setLoadingKpis(false); }
        };
        fetchKpis();
    } else {
        setLoadingKpis(false);
        setKpiProcessosAtivos(0); setKpiPrazosProximos(0); setKpiTotalClientes(0);
    }
  }, [currentUser]);

  // NOVO useEffect PARA BUSCAR NOVAS OCORRÊNCIAS
  useEffect(() => {
    // Este dashboard é para advogados, então não precisamos checar o papel aqui
    // se o ProtectedRoute já garante que só advogados chegam nesta rota.
    // Apenas verificamos se há um usuário logado.
    if (auth.currentUser) {
      setLoadingOcorrencias(true);
      setErrorOcorrencias(null);
      console.log("Dashboard Adv: Iniciando busca por Novas Ocorrências (status 'Enviada')...");

      const ocorrenciasRef = collection(db, "ocorrencias");
      const q = query(
        ocorrenciasRef,
        where("statusOcorrencia", "==", "Enviada"),
        orderBy("criadoEm", "desc"),
        limit(5) 
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const itensData = [];
        querySnapshot.forEach((doc) => {
          itensData.push({ id: doc.id, ...doc.data() });
        });
        setNovasOcorrencias(itensData);
        setLoadingOcorrencias(false);
        console.log("Dashboard Adv: Novas ocorrências carregadas:", itensData.length, itensData);
      }, (error) => {
        console.error("Dashboard Adv: Erro ao buscar novas ocorrências: ", error);
        setErrorOcorrencias("Não foi possível carregar as novas ocorrências.");
        setLoadingOcorrencias(false);
      });

      return () => {
        console.log("Dashboard Adv: Limpando listener de Novas Ocorrências.");
        unsubscribe();
      };
    } else {
      setNovasOcorrencias([]);
      setLoadingOcorrencias(false);
    }
  }, []); // Executa na montagem e o onSnapshot cuida das atualizações

  // Dados para o gráfico de Pizza
  const dataStatusProcessos = [
    { name: 'Outros Ativos', value: Math.max(0, kpiProcessosAtivos - kpiPrazosProximos) },
    { name: 'Prazos Urgentes', value: kpiPrazosProximos },
  ].filter(entry => entry.value > 0);

  return (
    <div className="dashboard-futuristic-container">
      <div className="dashboard-main-header">
        <h1>Seu Painel Jurídico</h1>
        <p>Insights e ações rápidas para otimizar sua rotina.</p>
      </div>

      <section className="kpi-highlight-section">
        <div className="kpi-main-card">
          <div className="kpi-title">
            <ChartIcon />
            <h3>Performance Geral</h3>
          </div>
          {loadingKpis ? <p className="loading-text">Carregando indicadores...</p> : (
            <div className="kpi-values-grid">
              <div className="kpi-value-item">
                <span className="kpi-value">{kpiProcessosAtivos}</span>
                <label>Processos Ativos</label>
                <div className="kpi-chart-container">
                    <ResponsiveContainer width="100%" height={70}>
                        <BarChart data={[{name: 'Ativos', value: kpiProcessosAtivos}]} layout="vertical" margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" hide/>
                            <Bar dataKey="value" fill="var(--cor-acento)" barSize={15} radius={[0, 8, 8, 0]}/>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
              </div>
              <div className="kpi-value-item">
                <span className="kpi-value">{kpiPrazosProximos}</span>
                <label>Prazos Urgentes (7d)</label>
                 <div className="kpi-chart-container">
                    <ResponsiveContainer width="100%" height={70}>
                        <BarChart data={[{name: 'Prazos', value: kpiPrazosProximos}]} layout="vertical" margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" hide/>
                            <Bar dataKey="value" fill="#FFBB28" barSize={15} radius={[0, 8, 8, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
              </div>
              <div className="kpi-value-item">
                <span className="kpi-value">{kpiTotalClientes}</span>
                <label>Total de Clientes</label>
                <div className="kpi-chart-container"> {/* Placeholder para gráfico de clientes */} </div>
              </div>
            </div>
          )}
        </div>
        <div className="kpi-chart-card">
           <h3>Distribuição de Status (Ativos)</h3>
           {loadingKpis ? <p className="loading-text">Carregando gráfico...</p> :
            dataStatusProcessos.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                  <Pie
                      data={dataStatusProcessos}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={70}
                      innerRadius={40}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                      {dataStatusProcessos.map((entry, index) => ( <Cell key={`cell-${index}`} fill={KPI_COLORS[index % KPI_COLORS.length]} /> ))}
                  </Pie>
                  <Tooltip formatter={(value, name, entry) => { const total = dataStatusProcessos.reduce((sum, item) => sum + item.value, 0); const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : 0; return [`${value} (${percentage}%)`, name]; }} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: "12px", marginTop: "0px"}}/>
                  </PieChart>
              </ResponsiveContainer>
            ) : ( <p className="empty-state-chart">Sem dados para o gráfico de distribuição.</p> )
           }
        </div>
      </section>

      <div className="dashboard-columns-grid dashboard-triple-grid">
        <section className="dashboard-column-item">
          <div className="column-header">
            <h2><InboxIcon /> Novas Ocorrências</h2>
            {/* <Link to="/ocorrencias" className="view-all-link-styled">Ver Todas <ArrowRightIcon /></Link> */}
          </div>
          {loadingOcorrencias ? <p className="loading-text">Carregando ocorrências...</p> :
           errorOcorrencias ? <p className="form-feedback error">{errorOcorrencias}</p> :
           (
            <ul className="info-list-styled">
              {novasOcorrencias.length > 0 ? novasOcorrencias.map(ocorrencia => (
                <li key={ocorrencia.id}>
                  <Link to={`/ocorrencias/${ocorrencia.id}`}> {/* Rota futura */}
                    <span className="info-title" title={ocorrencia.titulo}>
                      {ocorrencia.titulo.length > 35 ? ocorrencia.titulo.substring(0,32) + "..." : ocorrencia.titulo}
                    </span>
                    <small className="info-subtext">
                        Por: {ocorrencia.clienteNome || 'Cliente Desconhecido'}
                        <br/>
                        Em: {formatDate(ocorrencia.criadoEm)}
                    </small>
                  </Link>
                </li>
              )) : <li>Nenhuma nova ocorrência pendente.</li>}
            </ul>
          )}
        </section>

        <section className="dashboard-column-item">
          <div className="column-header">
            <h2><FolderIcon /> Processos Recentes</h2>
            <Link to="/processos" className="view-all-link-styled">Ver Todos <ArrowRightIcon /></Link>
          </div>
          {loadingProcesses ? <p className="loading-text">Carregando processos...</p> : (
            <ul className="info-list-styled">
              {recentProcesses.length > 0 ? recentProcesses.map(proc => (
                <li key={proc.id}>
                  <Link to={`/processos/${proc.id}`}>
                    <span className="info-title">{proc.numeroOficial || proc.numeroInterno || "Processo sem Ident."}</span>
                    <span className={`info-tag status-${(proc.status || 'desconhecido').toLowerCase().replace(/\s+/g, '-')}`}>{proc.status}</span>
                  </Link>
                </li>
              )) : <li>Nenhum processo recente.</li>}
            </ul>
          )}
        </section>

        <section className="dashboard-column-item">
          <div className="column-header">
            <h2><CalendarIcon /> Agenda da Semana</h2>
            <Link to="/agenda" className="view-all-link-styled">Ver Agenda <ArrowRightIcon /></Link>
          </div>
          {loadingAgenda ? <p className="loading-text">Carregando agenda...</p> : (
            <ul className="info-list-styled">
              {agendaSemana.length > 0 ? agendaSemana.map(item => (
                <li key={item.id}>
                  {/* Link para o item da agenda seria ideal no futuro */}
                  <span className="info-date">{formatDate(item.dataHoraInicio, true)}</span>
                  <span className="info-title" title={item.titulo}>{item.titulo.length > 30 ? item.titulo.substring(0,27) + "..." : item.titulo}</span>
                  <span className="info-tag tag-tipo">{item.tipo}</span>
                </li>
              )) : <li>Nenhum compromisso para os próximos 7 dias.</li>}
            </ul>
          )}
        </section>
      </div>
      
      <section className="dashboard-section assistente-ia-highlight">
         <h2><AssistenteIAIcon /> Assistente Virtual Jurídico</h2>
        <p>Precisa de ajuda com alguma questão jurídica geral ou funcionalidade da plataforma?</p>
        <button onClick={() => navigate('/assistente-ia')} className="button-glow-primary">
          Consultar Assistente IA
        </button>
      </section>
    </div>
  );
}
export default Dashboard;