import React, { useRef, useState } from 'react';
import { Upload, Trash2, PlusCircle, LayoutGrid, RefreshCcw, Database } from 'lucide-react';
import type { HRBase, HRMember } from '../utils/excelProcessor';

interface UploadSectionProps {
    onHRUpload: (data: any[], name: string, displayFields: { key: string; label: string }[]) => void;
    onAnalysisSuccess: (result: any) => void;
    hrBases: HRBase[];
    activeBaseId: string | null;
    onSelectBase: (id: string) => void;
    onDeleteBase: (id: string) => void;
    onUpdateBase: (id: string, data: HRMember[], displayFields: { key: string; label: string }[]) => void;
    hrData: HRMember[] | null;
    setIsProcessing: (loading: boolean) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
    onHRUpload,
    onAnalysisSuccess,
    hrBases,
    activeBaseId,
    onSelectBase,
    onDeleteBase,
    onUpdateBase,
    hrData,
    setIsProcessing
}) => {
    const hrInputRef = useRef<HTMLInputElement>(null);
    const visitInputRef = useRef<HTMLInputElement>(null);
    const updateInputRef = useRef<HTMLInputElement>(null);
    const hrWorkerRef = useRef<Worker | null>(null);

    const [isDraggingHR, setIsDraggingHR] = useState(false);
    const [isDraggingVisits, setIsDraggingVisits] = useState(false);

    // Upload State
    const [newBaseName, setNewBaseName] = useState("");
    const [updatingBaseId, setUpdatingBaseId] = useState<string | null>(null);

    // Field Selection State
    const [showFieldSelection, setShowFieldSelection] = useState(false);
    const [availableFields, setAvailableFields] = useState<string[]>([]);
    const [selectedFields, setSelectedFields] = useState<string[]>([]); // Keys to keep
    const [pendingName, setPendingName] = useState("");
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");

    // Standard fields that are always selected/recommended
    const STANDARD_FIELDS = [
        'cuid', 'login', 'code utilisateur', 'identifiant',
        'nom', 'prenoms', 'prénoms', 'nom_prenom', 'fullname',
        'direction', 'dr',
        'departement', 'département', 'dept',
        'service', 'serv',
        'perimetre', 'périmètre', 'perimeter', 'secteur',
        'fonction', 'poste', 'job',
        'ra', 'superviseur', 'supervisor', 'n+1', 'n1', 'n+2', 'n2',
        'email', 'mail', 'adresse mail'
    ];

    const processHRFile = async (file: File, name: string, isUpdate: boolean = false) => {
        setIsParsing(true);
        setUploadProgress("Initialisation...");

        if (hrWorkerRef.current) {
            hrWorkerRef.current.terminate();
        }

        const worker = new Worker(new URL('../utils/processor.worker.ts', import.meta.url), { type: 'module' });
        hrWorkerRef.current = worker;

        worker.onmessage = (e) => {
            if (e.data.type === 'PARSE_SUCCESS') {
                const { keys, rowCount } = e.data;
                setIsParsing(false);

                if (rowCount === 0) {
                    alert("Le fichier semble vide.");
                    worker.terminate();
                    hrWorkerRef.current = null;
                    return;
                }

                setAvailableFields(keys);

                const preSelected = keys.filter((key: string) =>
                    STANDARD_FIELDS.some(std => key.toLowerCase().includes(std) || key.toLowerCase() === std)
                );

                setSelectedFields(preSelected.length > 0 ? preSelected : keys);
                setPendingName(name);
                setIsUpdateMode(isUpdate);
                setShowFieldSelection(true);
            } else if (e.data.type === 'PROGRESS') {
                setUploadProgress(e.data.message);
            } else if (e.data.type === 'ERROR') {
                setIsParsing(false);
                alert("Erreur lors de la lecture du fichier: " + e.data.error);
                worker.terminate();
                hrWorkerRef.current = null;
            }
        };

        worker.onerror = (err) => {
            console.error("Worker Error:", err);
            setIsParsing(false);
            alert("Impossible de démarrer le moteur d'importation.");
            worker.terminate();
            hrWorkerRef.current = null;
        };

        worker.postMessage({ type: 'PARSE_EXCEL', file });
    };

    const processVisitsFile = async (file: File) => {
        if (!activeBaseId || !hrData) {
            alert("Veuillez sélectionner une base RH avant d'importer les visites.");
            return;
        }

        setIsParsing(true);
        setIsProcessing(true);
        setUploadProgress("Initialisation...");

        const worker = new Worker(new URL('../utils/processor.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (ev) => {
            if (ev.data.type === 'ANALYSIS_SUCCESS') {
                onAnalysisSuccess(ev.data.result);
                setIsParsing(false);
                setIsProcessing(false);
                worker.terminate();
            } else if (ev.data.type === 'PROGRESS') {
                setUploadProgress(ev.data.message);
            } else if (ev.data.type === 'ERROR') {
                alert("Erreur lors de l'analyse : " + ev.data.error);
                setIsParsing(false);
                setIsProcessing(false);
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            console.error("Worker Error:", err);
            setIsParsing(false);
            alert("Erreur lors du chargement de l'assistant d'analyse.");
            worker.terminate();
        };

        worker.postMessage({
            type: 'PARSE_AND_PROCESS_VISITS',
            file,
            hrBase: hrData,
            strictMode: true
        });
    };

    const confirmFieldSelection = () => {
        if (!hrWorkerRef.current) {
            alert("Session d'importation perdue. Veuillez recommencer.");
            setShowFieldSelection(false);
            return;
        }

        setIsParsing(true);
        setUploadProgress("Préparation du traitement...");

        const worker = hrWorkerRef.current;

        worker.onmessage = (e) => {
            if (e.data.type === 'MAP_SUCCESS') {
                const mappedData = e.data.mappedData;

                // Create Display Fields config
                const displayFields = selectedFields.map(key => ({
                    key: key,
                    label: key
                }));

                if (isUpdateMode && updatingBaseId) {
                    onUpdateBase(updatingBaseId, mappedData, displayFields);
                } else {
                    onHRUpload(mappedData, pendingName, displayFields);
                }

                setIsParsing(false);
                setShowFieldSelection(false);
                setPendingName("");
                if (updatingBaseId) setUpdatingBaseId(null);
                worker.terminate();
                hrWorkerRef.current = null;

            } else if (e.data.type === 'PROGRESS') {
                setUploadProgress(e.data.message);
            } else if (e.data.type === 'ERROR') {
                setIsParsing(false);
                alert("Erreur lors du traitement: " + e.data.error);
                worker.terminate();
                hrWorkerRef.current = null;
            }
        };

        worker.postMessage({
            type: 'MAP_HR_DATA',
            selectedFields
        });
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
            processHRFile(file, newBaseName, false);
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
                            processHRFile(file, newBaseName, false);
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
            {updatingBaseId && !showFieldSelection && (
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
                                    processHRFile(file, "", true);
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
                                    processHRFile(file, "", true);
                                    e.target.value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Field Selection Modal */}
            {showFieldSelection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-brand-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] m-4 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-8 border-b border-brand-border">
                            <h3 className="text-xl font-bold text-text-primary mb-1">Sélection des Colonnes</h3>
                            <p className="text-text-secondary text-sm">Choisissez les informations à afficher dans le rapport final.</p>
                        </div>

                        <div className="p-8 overflow-y-auto flex-grow custom-scrollbar bg-slate-50/30">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableFields.map(field => (
                                    <label key={field} className="flex items-center gap-3 p-3.5 rounded-lg bg-white border border-brand-border hover:border-slate-300 cursor-pointer transition-all group shadow-sm">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-orange-primary focus:ring-orange-primary focus:ring-offset-0"
                                            checked={selectedFields.includes(field)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedFields(prev => [...prev, field]);
                                                } else {
                                                    setSelectedFields(prev => prev.filter(f => f !== field));
                                                }
                                            }}
                                        />
                                        <span className={`text-sm font-medium ${selectedFields.includes(field) ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                                            {field}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-brand-border flex justify-end gap-3 bg-slate-50">
                            <button
                                onClick={() => {
                                    if (hrWorkerRef.current) {
                                        hrWorkerRef.current.terminate();
                                        hrWorkerRef.current = null;
                                    }
                                    setShowFieldSelection(false);
                                    setUpdatingBaseId(null);
                                }}
                                className="px-5 py-2 rounded-md hover:bg-slate-200 text-text-secondary hover:text-text-primary font-bold text-sm transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmFieldSelection}
                                className="btn-primary"
                            >
                                CONFIRMER ({selectedFields.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
