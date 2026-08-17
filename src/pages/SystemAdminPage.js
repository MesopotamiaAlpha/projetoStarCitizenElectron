import React, { useState } from 'react';
import { FolderCog, FolderTree, Globe2, ListChecks } from 'lucide-react';
import LocationsAdminPage from './LocationsAdminPage';
import { MissionAdminPage } from './MissionAdminPage';
import InventoryTaxonomyAdminPage from './InventoryTaxonomyAdminPage';

const TABS = [
  { id: 'locations', label: 'Locais', description: 'Sistemas, planetas, estações e hangares', icon: Globe2, color: '#38bdf8' },
  { id: 'missions', label: 'Missões', description: 'Facções, tipos e sistemas de missão', icon: ListChecks, color: '#a78bfa' },
  { id: 'taxonomy', label: 'Categorias', description: 'Categorias e subcategorias do Inventário', icon: FolderTree, color: '#34d399' },
];

const TAB_KEY = 'sc_system_admin_tab_v1';

function initialTab() {
  try {
    const stored = localStorage.getItem(TAB_KEY);
    return TABS.some(tab => tab.id === stored) ? stored : 'locations';
  } catch {
    return 'locations';
  }
}

export default function SystemAdminPage() {
  const [activeTab, setActiveTab] = useState(initialTab);

  function selectTab(tabId) {
    setActiveTab(tabId);
    try { localStorage.setItem(TAB_KEY, tabId); } catch { /* armazenamento opcional */ }
  }

  return (
    <div className="system-admin-page">
      <div className="page-header system-admin-header">
        <div>
          <div className="page-title system-admin-title"><FolderCog size={18} /> SISTEMA</div>
          <div className="page-subtitle">Administre em um só lugar os locais, os campos de missão e a estrutura do Inventário.</div>
        </div>
      </div>
      <div className="system-admin-body">
        <nav className="system-admin-tabs" aria-label="Administradores do sistema">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return <button type="button" key={tab.id} className={`system-admin-tab${active ? ' active' : ''}`} style={{ '--system-tab-color': tab.color }} onClick={() => selectTab(tab.id)} aria-selected={active}>
              <span className="system-admin-tab-icon"><Icon size={16} /></span>
              <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
            </button>;
          })}
        </nav>
        <main className="system-admin-content">
          {activeTab === 'locations' && <LocationsAdminPage embedded />}
          {activeTab === 'missions' && <MissionAdminPage embedded />}
          {activeTab === 'taxonomy' && <InventoryTaxonomyAdminPage embedded />}
        </main>
      </div>
    </div>
  );
}
