import React, { useRef, useState } from 'react';
import { Upload, Trash2, PlusCircle, LayoutGrid, RefreshCcw, Database } from 'lucide-react';
import type { HRBase, HRMember } from '../utils/excelProcessor';
import { api } from '../services/api';

interface UploadSectionProps {
    onAnalysisSuccess: (result: any) => void;
    hrBases: HRBase[];
    activeBaseId: string | null;
    onSelectBase: (id: string) => void;
    onDeleteBase: (id: string) => void;
    hrData: HRMember[] | null;
    setIsProcessing: (loading: boolean) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
    onAnalysisSuccess,
    hrBases,
    activeBaseId,
    onSelectBase,
    onDeleteBase,
    hrData,
    setIsProcessing
}) => {
    const hrInputRef = useRef<HTMLInputElement>(null);
    const visitInputRef = useRef<HTMLInputElement>(null);
    const updateInputRef = useRef<HTMLInputElement>(null);

    const [isDraggingHR, setIsDraggingHR] = useState(false);
    const [isDraggingVisits, setIsDraggingVisits] = useState(false);

    // Upload State
    const [newBaseName, setNewBaseName] = useState("");
    const [updatingBaseId, setUpdatingBaseId] = useState<string | null>(null);

    const [isParsing, setIsParsing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");


    const processHRFile = async (file: File, name: string) => {
        setIsParsing(true);
        setIsProcessing(true);
        setUploadProgress("Envoi de la base RH au serveur...");

        try {
            await api.uploadHRBase(file, name);
            // After successful upload, refresh the bases list
            window.location.reload(); // Simple way to refresh state for now
        } catch (err: any) {
            console.error("HR Upload Error:", err);
            alert("Erreur lors de l'upload HR : " + (err.message || "Erreur serveur"));
        } finally {
            setIsParsing(false);
            setIsProcessing(false);
        }
    };

    const processVisitsFile = async (file: File) => {
        if (!activeBaseId || !hrData) {
            alert("Veuillez sélectionner une base RH avant d'importer les visites.");
            return;
        }

        setIsParsing(true);
        setIsProcessing(true);
        setUploadProgress("Envoi au serveur pour analyse...");

        try {
            const result = await api.analyzeVisites(file, activeBaseId, true);
            onAnalysisSuccess(result);
        } catch (err: any) {
            console.error("Analysis Error:", err);
            alert("Erreur lors de l'analyse : " + (err.message || "Erreur serveur"));
        } finally {
            setIsParsing(false);
            setIsProcessing(false);
        }
    };

    const handleUpdateClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setUpdatingBaseId(id);
    };

    const handleHRUploadClick = () => {
        if (!newBaseName.trim()) {
            alert("Veuillez donner un nom à cette base RH avant de charger le fichier.");
            return;
        }
        hrInputRef.current?.click();
    };

    const handleHRDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingHR(false);

        if (!newBaseName.trim()) {
            alert("Veuillez donner un nom à cette base RH avant de glisser le fichier.");
            return;
        }

        const file = e.dataTransfer.files?.[0];
        if (file) {
            processHRFile(file, newBaseName);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in slide-in-from-bottom duration-500">
            {/* HR Base Management */}
            <div
                className={`glass p-5 overflow-hidden relative ${isDraggingHR ? 'border-orange-primary bg-orange-primary/5' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingHR(true); }}
                onDragLeave={() => setIsDraggingHR(false)}
                onDrop={handleHRDrop}
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-orange-primary/[0.03] rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 relative z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-text-primary">Bases de Données RH</h2>
                        <p className="text-text-secondary text-sm">Gérez vos référentiels collaborateurs</p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-brand-border w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Nom de la base..."
                            value={newBaseName}
                            onChange={(e) => setNewBaseName(e.target.value)}
                            className="bg-transparent px-4 py-2 text-sm outline-none font-medium flex-grow md:w-64 text-text-primary placeholder:text-text-muted"
                        />
                        <button
                            onClick={handleHRUploadClick}
                            className="btn-primary flex items-center gap-2 !py-2 !px-4 text-xs shadow-sm"
                        >
                            <PlusCircle size={16} />
                            AJOUTER
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {hrBases.length === 0 ? (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-brand-border rounded-xl bg-slate-50/30">
                            <LayoutGrid size={40} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-text-secondary font-medium">Aucune base RH enregistrée</p>
                        </div>
                    ) : (
                        hrBases.map((base) => (
                            <div
                                key={base.id}
                                className={`group p-6 rounded-2xl border transition-all cursor-pointer flex items-center justify-between
                                    ${activeBaseId === base.id ? 'border-orange-primary bg-orange-primary shadow-lg' : 'border-[#f1f5f9] bg-white hover:border-slate-200 shadow-sm hover:shadow-md'}`}
                                onClick={() => onSelectBase(base.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm
                                        ${activeBaseId === base.id ? 'bg-white text-orange-primary shadow-lg' : 'bg-slate-50 text-text-muted border border-[#f1f5f9]'}`}>
                                        {base.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className={`font-semibold text-[14px] truncate max-w-[150px] ${activeBaseId === base.id ? 'text-white' : 'text-text-primary'}`}>{base.name}</div>
                                        <div className={`text-[11px] font-medium uppercase tracking-widest mt-0.5 ${activeBaseId === base.id ? 'text-white/90' : 'text-text-muted'}`}>{base.data.length} membres</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleUpdateClick(e, base.id)}
                                        className={`p-2.5 rounded-full transition-all border ${activeBaseId === base.id ? 'text-white hover:text-orange-primary hover:bg-white border-transparent hover:border-white' : 'text-text-muted hover:text-orange-primary hover:bg-white border-transparent hover:border-slate-100'}`}
                                        title="Réinitialiser les données"
                                    >
                                        <RefreshCcw size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteBase(base.id); }}
                                        className={`p-2.5 rounded-full transition-all border ${activeBaseId === base.id ? 'text-white hover:text-rose-500 hover:bg-white border-transparent hover:border-white' : 'text-text-muted hover:text-rose-500 hover:bg-white border-transparent hover:border-slate-100'}`}
                                        title="Supprimer la base"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <input
                    type="file"
                    ref={hrInputRef}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            processHRFile(file, newBaseName);
                        }
                    }}
                />
            </div>

            {/* Daily Reporting Upload */}
            <div className="grid grid-cols-1 gap-10">
                <div
                    onClick={() => visitInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingVisits(true); }}
                    onDragLeave={() => setIsDraggingVisits(false)}
                    onDrop={async (e) => {
                        e.preventDefault();
                        setIsDraggingVisits(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                            processVisitsFile(file);
                        }
                    }}
                    className={`relative min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] transition-all cursor-pointer p-16 overflow-hidden group
                        ${isDraggingVisits ? 'border-orange-primary bg-orange-primary/5 shadow-2xl scale-[1.01]' :
                            'border-[#f1f5f9] bg-white hover:border-orange-primary/20 hover:bg-slate-50/30 shadow-sm'}`}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none" />

                    <input
                        type="file"
                        ref={visitInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                processVisitsFile(file);
                            }
                        }}
                    />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-orange-primary/10 text-orange-primary rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
                            <Upload size={42} />
                        </div>

                        <h3 className="text-3xl font-semibold text-text-primary tracking-tight mb-3">Rapport Quotidien</h3>
                        <p className="text-text-secondary max-w-sm mb-10 leading-relaxed font-normal">
                            Glissez-déposez vos fichiers .xlsx ou cliquez pour importer vos logs de visite.
                        </p>

                        {!activeBaseId && (
                            <div className="px-6 py-2.5 bg-rose-50 border border-rose-100 rounded-full flex items-center gap-2.5 text-rose-500 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                                <Database size={14} />
                                Sélectionnez d'abord une base RH
                            </div>
                        )}

                        {activeBaseId && (
                            <div className="px-6 py-2.5 bg-slate-50 border border-[#f1f5f9] rounded-full text-text-muted text-[10px] font-bold uppercase tracking-widest">
                                Format compatible .XLSX
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isParsing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-primary"></div>
                        <div className="text-center">
                            <p className="font-bold text-text-primary">Chargement du fichier...</p>
                            <p className="text-sm text-text-secondary mt-1">{uploadProgress}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Update Modal */}
            {updatingBaseId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-brand-border p-8 rounded-xl shadow-2xl max-w-lg w-full m-4 relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setUpdatingBaseId(null)}
                            className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
                        >
                            <Trash2 className="rotate-45" size={24} />
                        </button>

                        <h3 className="text-xl font-bold text-text-primary mb-2">Mise à jour de la base</h3>
                        <p className="text-text-secondary text-sm mb-6">Glissez votre nouveau fichier ou cliquez pour sélectionner.</p>

                        <div
                            onClick={() => updateInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingHR(true); }}
                            onDragLeave={() => setIsDraggingHR(false)}
                            onDrop={async (e) => {
                                e.preventDefault();
                                setIsDraggingHR(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file && updatingBaseId) {
                                    processHRFile(file, "");
                                }
                            }}
                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                                    ${isDraggingHR ? 'border-orange-primary bg-orange-primary/5' : 'border-brand-border hover:border-orange-primary/30 hover:bg-slate-50'}`}
                        >
                            <Upload size={48} className="mx-auto text-orange-primary mb-4" />
                            <p className="font-bold text-text-primary">Cliquez ou déposez le fichier ici</p>
                            <p className="text-xs text-text-secondary mt-2">Format .xlsx ou .xls</p>
                        </div>
                        {/* Hidden Input for Updates inside the modal */}
                        <input
                            type="file"
                            ref={updateInputRef}
                            className="hidden"
                            accept=".xlsx, .xls"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && updatingBaseId) {
                                    processHRFile(file, "");
                                    e.target.value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            )}

        </div >
    );
};
