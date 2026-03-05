import { useState, useMemo, useEffect } from 'react';
import { Database, BarChart3, HelpCircle } from 'lucide-react';
import { UploadSection } from './components/UploadSection';
import { Dashboard } from './components/Dashboard';
import type { HRMember, HRBase } from './utils/excelProcessor';
import { api } from './services/api';
import './index.css';

function App() {

  const [activeTab, setActiveTab] = useState<'upload' | 'dashboard'>('upload');
  const [hrBases, setHrBases] = useState<HRBase[]>([]);
  const [activeBaseId, setActiveBaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  // Persistence: Load from MongoDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedBases, loadedAnalysis, loadedActiveId] = await Promise.all([
          api.getAllHRBases(),
          api.getState('analysis'),
          api.getState('activeBaseId')
        ]);

        if (loadedBases && loadedBases.length > 0) {
          setHrBases(loadedBases);
        }

        if (loadedActiveId) {
          setActiveBaseId(loadedActiveId as string);
        } else if (loadedBases && loadedBases.length > 0) {
          setActiveBaseId(loadedBases[0].id);
        }

        if (loadedAnalysis) {
          setAnalysis(loadedAnalysis);
          setActiveTab('dashboard');
        }
      } catch (e) {
        console.error("Failed to load data from MongoDB:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Persistence: Save HR Bases
  useEffect(() => {
    if (!isLoading && hrBases.length > 0) {
      api.syncHRBases(hrBases).catch(err => console.error("Failed to sync HR bases to MongoDB", err));
    }
  }, [hrBases, isLoading]);

  // Persistence: Save Active ID
  useEffect(() => {
    if (!isLoading && activeBaseId) {
      api.updateState('activeBaseId', activeBaseId).catch(console.error);
    }
  }, [activeBaseId, isLoading]);

  // Persistence: Save Analysis Result
  useEffect(() => {
    if (!isLoading) {
      if (analysis) {
        api.updateState('analysis', analysis).catch(console.error);
      } else {
        api.clearState('analysis').catch(console.error);
      }
    }
  }, [analysis, isLoading]);


  const activeBase = useMemo(() =>
    hrBases.find(b => b.id === activeBaseId) || null,
    [hrBases, activeBaseId]);

  const hrData = activeBase?.data || null;

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveTab(customEvent.detail);
    };
    window.addEventListener('switch-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-tab', handleSwitchTab);
  }, []);

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Analysis is now driven by UploadSection directly for memory efficiency

  const handleHRUpload = (data: HRMember[], baseName: string, displayFields: { key: string; label: string }[]) => {
    const newBase: HRBase = {
      id: crypto.randomUUID(),
      name: baseName,
      data: data,
      displayFields: displayFields
    };

    setHrBases(prev => [...prev, newBase]);
    setActiveBaseId(newBase.id);
  };

  const deleteBase = (id: string) => {
    if (confirm("Voulez-vous supprimer cette base RH ?")) {
      setHrBases(prev => prev.filter(b => b.id !== id));
      if (activeBaseId === id) setActiveBaseId(null);
    }
  };

  const updateBase = (id: string, data: HRMember[], displayFields: { key: string; label: string }[]) => {
    setHrBases(prev => prev.map(b => b.id === id ? { ...b, data, displayFields } : b));
  };


  const handleAnalysisSuccess = (result: any) => {
    setAnalysis(result);
    setActiveTab('dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 min-h-screen text-text-primary font-sans relative">
      {/* Global Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4 p-8 bg-white border border-brand-border rounded-2xl shadow-2xl">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-primary"></div>
            <div className="text-center">
              <p className="font-bold text-text-primary">Analyse en cours...</p>
              <p className="text-xs text-text-secondary mt-1">Traitement des fichiers volumineux</p>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="sidebar fixed h-full z-10 w-[280px] flex flex-col border-r border-brand-border bg-white shadow-sm">
        <div className="flex items-center gap-3 mb-10 p-6 border-b border-brand-border h-[100px]">
          <img src="/logo.jpg" alt="Logo" className="w-9 h-9 object-cover rounded-md" />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight text-text-primary">Yelen</span>
            <span className="text-orange-primary text-[10px] font-semibold tracking-wider uppercase">Reporting</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 px-4 flex-grow">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-3.5 px-3.5 py-3 rounded-md transition-all duration-200 ${activeTab === 'upload' ? 'bg-orange-primary/10 text-orange-primary font-semibold shadow-sm' : 'text-text-secondary hover:bg-slate-100/80 hover:text-text-primary'}`}
          >
            <Database size={17} />
            <span className="text-[13px]">Sources de Données</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3.5 px-3.5 py-3 rounded-md transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-orange-primary/10 text-orange-primary font-semibold shadow-sm' : 'text-text-secondary hover:bg-slate-100/80 hover:text-text-primary'}`}
          >
            <BarChart3 size={17} />
            <span className="text-[13px]">Tableau de Bord</span>
          </button>
        </nav>

        <div className="p-6">
          <div className="rounded-lg p-5 bg-slate-50 border border-brand-border">
            <div className="flex items-center gap-2 text-text-primary mb-2">
              <HelpCircle size={16} />
              <span className="text-xs font-bold">Support Yelen</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Consultez les guides internes pour l'export des rapports de visite.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content flex-grow ml-[280px] p-8 min-h-screen bg-slate-50">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-1">
              {activeTab === 'upload' ? (
                <>Gestion <span className="text-orange-primary">Data</span></>
              ) : (
                <>Analyse <span className="text-orange-primary">Visites</span></>
              )}
            </h1>
            <p className="text-text-secondary text-sm">
              Plateforme Interne • Orange Côte d'Ivoire
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className={`w-2 h-2 rounded-full ${hrData ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-xs font-medium text-text-secondary">Status Base RH</span>
            </div>
          </div>
        </header>

        {analysisError ? (
          <div className="min-h-screen bg-white flex items-center justify-center text-text-primary">
            <div className="flex flex-col items-center gap-6 p-12 bg-slate-50 border border-brand-border rounded-2xl shadow-sm max-w-md text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <Database size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Erreur d'Analyse</h2>
                <p className="text-text-secondary mb-8 font-medium">{analysisError}</p>
                <button
                  onClick={() => { setAnalysisError(null); }}
                  className="btn-primary w-full"
                >
                  Retourner aux sources
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'upload' ? (
          <div className="flex flex-col gap-10">
            <UploadSection
              onHRUpload={handleHRUpload}
              onAnalysisSuccess={handleAnalysisSuccess}
              hrBases={hrBases}
              activeBaseId={activeBaseId}
              onSelectBase={setActiveBaseId}
              onDeleteBase={deleteBase}
              onUpdateBase={updateBase}
              hrData={hrData}
              setIsProcessing={setIsProcessing}
            />

            {hrData && (
              <div className="glass overflow-hidden">
                <div className="px-5 py-5 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Aperçu Base RH</h3>
                    <p className="text-text-secondary text-sm mt-1">Vérification de l'intégrité des colonnes importées</p>
                  </div>
                  <span className="bg-slate-100 text-text-secondary px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200">
                    {hrData.length} ENTRÉES
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {(activeBase?.displayFields || [
                          { key: 'cuid', label: 'CUID' },
                          { key: 'name', label: 'Collaborateur' },
                          { key: 'perimeter', label: 'Périmètre' },
                          { key: 'direction', label: 'Direction' },
                          { key: 'jobTitle', label: 'Fonction' },
                          { key: 'supervisor', label: 'Superviseur' }
                        ]).map((col, idx) => (
                          <th key={idx} className="px-4 py-4 text-xs font-medium text-text-secondary">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {hrData.slice(0, 10).map((m, i) => (
                        <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                          {(activeBase?.displayFields || [
                            { key: 'cuid', label: 'Login' },
                            { key: 'name', label: 'Collaborateur' },
                            { key: 'perimeter', label: 'Périmètre' },
                            { key: 'direction', label: 'Direction' },
                            { key: 'jobTitle', label: 'Fonction' },
                            { key: 'supervisor', label: 'Superviseur' }
                          ]).map((col, idx) => {
                            const val = m[col.key];
                            return (
                              <td key={idx} className="px-4 py-4">
                                {idx === 0 ? (
                                  <span className="font-medium text-text-primary text-sm">{String(val || '-')}</span>
                                ) : (
                                  <div className="text-sm text-text-secondary">{String(val || '-')}</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hrData.length > 10 && (
                  <div className="mt-8 pt-8 border-t-2 border-brand-border text-center">
                    <p className="text-text-secondary text-[10px] font-bold uppercase tracking-wider">
                      Affichage partiel des <span className="text-text-primary">{hrData.length}</span> entrées détectées
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          analysis && <Dashboard data={analysis} activeBase={activeBase} />
        )}
      </main>
    </div>
  );
}

export default App;
