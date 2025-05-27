import React from 'react';
import { NavLink } from 'react-router-dom';
import './SidebarNav.css';

// Ícones (adicionar ou ajustar conforme necessário)
const DashboardIcon = () => <span className="nav-icon">&#128196;</span>;
const ProcessosIcon = () => <span className="nav-icon">&#128193;</span>;
const ClientesIcon = () => <span className="nav-icon">&#128101;</span>;
const AgendaIcon = () => <span className="nav-icon">&#128197;</span>;
const AssistenteIcon = () => <span className="nav-icon">&#129302;</span>;
const OcorrenciasIcon = () => <span className="nav-icon">&#128230;</span>; // Ícone de Caixa de Entrada/Ocorrências

function SidebarNav() {
  return (
    <nav className="sidebar-nav">
      <ul>
        {/* Links Principais */}
        <li><NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} end><DashboardIcon /> Dashboard</NavLink></li>
        
        {/* NOVO LINK PARA OCORRÊNCIAS */}
        <li><NavLink to="/ocorrencias" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><OcorrenciasIcon /> Novas Ocorrências</NavLink></li>
        
        <li><NavLink to="/processos" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><ProcessosIcon /> Processos</NavLink></li>
        <li><NavLink to="/clientes" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><ClientesIcon /> Clientes</NavLink></li>
        <li><NavLink to="/agenda" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><AgendaIcon /> Agenda</NavLink></li>
        <li><NavLink to="/assistente-ia" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><AssistenteIcon /> Assistente IA</NavLink></li>

        {/* Acesso Rápido */}
        <li className="quick-actions-title">Acesso Rápido</li>
        <li><NavLink to="/processos/novo" className={({ isActive }) => isActive ? "nav-link quick-link active" : "nav-link quick-link"}> + Novo Processo </NavLink></li>
        <li><NavLink to="/clientes/novo" className={({ isActive }) => isActive ? "nav-link quick-link active" : "nav-link quick-link"}> + Novo Cliente </NavLink></li>
        <li><NavLink to="/agenda/novo" className={({ isActive }) => isActive ? "nav-link quick-link active" : "nav-link quick-link"}> + Novo Item Agenda </NavLink></li>
      </ul>
    </nav>
  );
}

export default SidebarNav;