import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, MousePointer2, LayoutDashboard, Search, Link as LinkIcon, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import type { AnalysisResult, HRBase, VisitRecord } from '../utils/excelProcessor';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const COLORS = ['#FF7900', '#0F172A', '#64748B', '#94A3B8', '#E2E8F0', '#50BE87', '#A885D8', '#FFB4E6', '#334155', '#475569'];

interface DashboardProps {
    data: AnalysisResult | null;
    activeBase: HRBase | null;
    visitData: VisitRecord[] | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, activeBase, visitData }) => {
    const [visibleCount, setVisibleCount] = useState(20);
    const [searchLink, setSearchLink] = useState('');
    const linkAnalysisRef = React.useRef<HTMLDivElement>(null);

    const { data: linkAnalysisData, total: linkAnalysisTotal } = useMemo(() => {
        if (!searchLink || !visitData || !activeBase) return { data: [], total: 0 };

        const searchTerm = searchLink.toLowerCase();
        // Filter visits that match the link
        const matchingVisits = visitData.filter(v =>
            (v.url && String(v.url).toLowerCase().includes(searchTerm)) ||
            (v.pageTitle && String(v.pageTitle).toLowerCase().includes(searchTerm))
        );

        if (matchingVisits.length === 0) return { data: [], total: 0 };

        // Group by Perimeter (Service) using HR Base
        const distribution: Record<string, number> = {};
        let totalStrict = 0;

        matchingVisits.forEach(visit => {
            if (!visit.cuid) return;
            const visitCuid = String(visit.cuid).toLowerCase().trim();
            const member = activeBase.data.find(m => m.cuid && String(m.cuid).toLowerCase().trim() === visitCuid);

            // Group by Service (as requested) matching the main chart logic
            if (!member) return; // Strict Mode: Exclude unknown visitors

            totalStrict++;
            const key = member.service || member.perimeter || member.direction || 'Inconnu';
            distribution[key] = (distribution[key] || 0) + 1;
        });

        // Convert to array and sort
        const chartData = Object.entries(distribution)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10

        return { data: chartData, total: totalStrict };
    }, [searchLink, visitData, activeBase]);

    // Export Functions
    // Export Functions
    const handleExportImage = async (elementOrId: string | React.RefObject<HTMLDivElement | null>, fileName: string) => {
        let element: HTMLElement | null = null;

        if (typeof elementOrId === 'string') {
            element = document.getElementById(elementOrId);
        } else if (elementOrId && 'current' in elementOrId) {
            element = elementOrId.current;
        }

        if (!element) {
            console.error("Export element not found");
            return;
        }

        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#121212', // Match dark theme
                scale: 2, // Improve quality
                useCORS: true, // Handle cross-origin images/fonts
                logging: false
            });
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (err: any) {
            console.error("Export image failed:", err);
            alert(`Une erreur est survenue: ${err?.message || 'Erreur inconnue'}`);
        }
    };

    /*
   # Modernisation selon la Charte Orange

L'application a été entièrement repensée pour s'aligner sur l'identité visuelle officielle d'Orange Digital : **Minimalisme, Contraste et Impact.**

## Changements Majeurs (Style Orange)

### ⚫️ Univers Visuel "Pure Black"
- **Contraste Maximal** : Utilisation d'un fond noir profond (#000000) et de textes blancs (#FFFFFF) pour une lisibilité parfaite.
- **Accents Orange Officiels** : Utilisation du Orange (#FF7900) comme repère visuel majeur pour les actions et les données clés.
- **Géométrie Franche** : Suppression des arrondis et des flous (glassmorphism) au profit de formes rectangulaires et de bordures nettes, fidèles à la marque.

### 🟧 Tableaux et Analytics Haute Performance
- **Dashboard Impactant** : Graphiques utilisant la palette Orange/Noir/Blanc pour une analyse instantanée.
- **Détails des Visiteurs** : Structure en blocs avec bordures gauches "accent" Orange. Chaque visite est clairement isolée.
- **Typographie Bold** : Utilisation de polices sans-serif audacieuses et en majuscules pour les titres et les labels, renforçant l'aspect professionnel.

### 🚀 Expérience Utilisateur Fluidifiée
- **Navigation Directe** : Barre latérale sobre avec des indicateurs d'état francs.
- **Header Monumental** : Titres larges et percutants pour une identification immédiate du contexte.

## Avant / Après (Résumé Orange)

| Élément | Version Précédente | Nouvelle Version Orange |
| :--- | :--- | :--- |
| **Fond** | Sombre / Gris bleu | **Noir Pur (#000000)** |
| **Bordures** | Floues / Translucides | **Franches / 2px (#333333)** |
| **Boutons** | Arrondis / Dégradés | **Carrés / Fond Orange ou Blanc** |
| **Tableaux** | Lignes simples | **Damiers sombres / Accents de bordure** |

## Vérification Effectuée
- [x] Conformité aux couleurs de la marque Orange.
- [x] Accessibilité du texte (Blanc sur Noir / Noir sur Orange).
- [x] Cohérence de la grille géométrique sur toutes les pages.
- [x] Restauration et amélioration de l'Analyse par Lien Spécifique.
*/
    const formatVisitsForExcel = (visits: VisitRecord[]) => {
        return visits.map(v => {
            const title = v.pageTitle || v.page || 'Page sans titre';
            const url = v.url || '';
            const date = v.date ? new Date(v.date).toLocaleDateString() : '';
            return `${title} - ${url} (${date})`;
        }).join('\n'); // Use newline for separation in cell
    };

    const prepareExcelData = (records: any[]) => {
        if (!activeBase?.displayFields) return [];

        return records.map(record => {
            const row: Record<string, any> = {};
            activeBase.displayFields.forEach(col => {
                row[col.label] = record.member[col.key] || '-';
            });
            row['Dernière Visite'] = record.lastVisit;
            row['Nombre de Pages'] = record.visits.length;

            // Rich formatting for Pages column: Title + URL
            row['Pages Visitées'] = formatVisitsForExcel(record.visits);

            return row;
        });
    };

    const handleExportExcel = () => {
        if (!data?.aggregatedVisits || !activeBase?.displayFields) return;

        const exportData = prepareExcelData(data.aggregatedVisits);
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Auto-width columns (simple heuristic)
        const objectMaxLength: number[] = [];
        for (let i = 0; i < exportData.length; i++) {
            let value = Object.values(exportData[i]);
            for (let j = 0; j < value.length; j++) {
                if (typeof value[j] === "number") {
                    objectMaxLength[j] = 10;
                } else {
                    objectMaxLength[j] =
                        objectMaxLength[j] >= String(value[j]).length
                            ? objectMaxLength[j]
                            : String(value[j]).length;
                }
            }
        }

        // Cap width for readability, especially for the potentially long 'Pages' column
        ws['!cols'] = objectMaxLength.map(w => ({ width: Math.min(w + 2, 100) }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tous les Visiteurs");
        XLSX.writeFile(wb, "yelen_details_visiteurs.xlsx");
    };

    const handleExportByService = () => {
        if (!data?.aggregatedVisits || !activeBase?.displayFields) return;

        const wb = XLSX.utils.book_new();

        // Group by Service
        const visitsByService: Record<string, any[]> = {};

        data.aggregatedVisits.forEach(record => {
            // Prioritize Service, then Perimeter, then Direction, then 'Autre'
            const serviceName = record.member.service || record.member.perimeter || record.member.direction || 'Autre';
            // Sanitize sheet name (Excel limit 31 chars, no special chars)
            // But we keep it simple for now, maybe truncate
            const safeName = String(serviceName).replace(/[*?\/\[\]]/g, '').substring(0, 30);

            if (!visitsByService[safeName]) {
                visitsByService[safeName] = [];
            }
            visitsByService[safeName].push(record);
        });

        // Create a sheet for each service
        Object.entries(visitsByService).forEach(([serviceName, records]) => {
            const exportData = prepareExcelData(records);
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Apply column widths
            const colWidths = Object.keys(exportData[0] || {}).map(() => ({ width: 20 }));
            // Make the Pages column wider
            if (colWidths.length > 0) colWidths[colWidths.length - 1] = { width: 80 };
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, serviceName);
        });

        XLSX.writeFile(wb, "yelen_visites_par_service.xlsx");
    };


    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-orange-primary/10 rounded-full flex items-center justify-center mb-6">
                    <LayoutDashboard size={40} className="text-orange-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Aucune donnée à analyser</h2>
                <p className="text-secondary max-w-md mb-8">
                    Veuillez d'abord charger la base RH et un rapport de visite dans la section "Sources de Données".
                </p>
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'upload' }))}
                    className="btn-primary"
                >
                    Charger les fichiers
                </button>
            </div>
        );
    }

    const serviceData = Object.entries(data.visitsByService || {}).map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        fullName: name,
        value,
    })).sort((a, b) => b.value - a.value).slice(0, 10); // Top 10

    const departmentData = Object.entries(data.visitsByDepartment || {}).map(([name, value]) => ({
        name,
        value,
    })).sort((a, b) => b.value - a.value);

    // Dynamic Columns Configuration
    const defaultColumns = [
        { key: 'name', label: 'Collaborateur' },
        { key: 'cuid', label: 'Login' },
        { key: 'jobTitle', label: 'Fonction' },
        { key: 'perimeter', label: 'Périmètre' },
        { key: 'direction', label: 'Direction' },
        { key: 'supervisor', label: 'Superviseur' }
    ];

    const displayColumns = activeBase?.displayFields && activeBase.displayFields.length > 0
        ? activeBase.displayFields
        : defaultColumns;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-brand-border p-4 shadow-lg rounded-lg">
                    <p className="text-text-secondary font-bold uppercase tracking-widest text-[10px] mb-1">{label}</p>
                    <p className="text-text-primary font-black text-xl">
                        {payload[0].value} <span className="text-[10px] text-text-muted font-bold tracking-tight">VISITES</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-12 animate-in fade-in duration-700">
            <div className="dashboard-grid">
                <div className="glass stat-card">
                    <div className="flex justify-between items-center mb-2">
                        <span className="stat-label">Total Visites</span>
                        <MousePointer2 className="text-orange-primary" size={20} />
                    </div>
                    <span className="stat-value">{data.totalVisits || 0}</span>
                </div>

                <div className="glass stat-card">
                    <div className="flex justify-between items-center mb-2">
                        <span className="stat-label">Visiteurs Uniques</span>
                        <Users className="text-orange-primary" size={20} />
                    </div>
                    <span className="stat-value">{data.uniqueVisitors || 0}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Services Chart */}
                <div className="glass p-5" id="chart-services">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-text-primary">Visites par Services</h3>
                        <button
                            onClick={() => handleExportImage('chart-services', 'visites_par_service')}
                            className="p-2 hover:bg-slate-100 rounded-md transition-colors text-text-secondary hover:text-text-primary"
                            title="Exporter en Image"
                        >
                            <ImageIcon size={18} />
                        </button>
                    </div>
                    <div className="h-[300px]">
                        {serviceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={serviceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
                                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" fill="#FF7900" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-text-muted text-sm">Aucune donnée disponible</div>
                        )}
                    </div>
                </div>

                {/* Departments Chart */}
                <div className="glass p-5" id="chart-departments">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-text-primary">Répartition par Département</h3>
                        <button
                            onClick={() => handleExportImage('chart-departments', 'repartition_departement')}
                            className="p-2 hover:bg-slate-100 rounded-md transition-colors text-text-secondary hover:text-text-primary"
                            title="Exporter en Image"
                        >
                            <ImageIcon size={18} />
                        </button>
                    </div>
                    <div className="h-[300px]">
                        {departmentData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={departmentData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: '#FFFFFF', strokeWidth: 1 }}
                                        style={{ outline: 'none' }}
                                    >
                                        {departmentData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ paddingTop: '20px' }}
                                        formatter={(value) => <span className="text-text-primary text-xs font-bold ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-secondary">Aucune donnée disponible</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Link Analysis Section */}
            <div className="glass p-10 shadow-xl" id="chart-link-analysis">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <h3 className="text-3xl font-black tracking-tight flex items-center gap-3 mb-2">
                            <LinkIcon size={28} className="text-orange-primary" />
                            Analyse par Lien Spécifique
                        </h3>
                        <p className="text-secondary font-medium">Analysez la fréquentation d'une page précise par service.</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                placeholder="Rechercher une URL ou un titre..."
                                value={searchLink}
                                onChange={(e) => setSearchLink(e.target.value)}
                                className="bg-white border border-brand-border text-text-primary rounded-lg px-6 py-3.5 pl-12 w-full focus:outline-none focus:border-orange-primary/30 focus:bg-slate-50/50 transition-all font-medium placeholder:text-text-muted/60 shadow-sm"
                            />
                            <Search className="absolute left-4 top-3.5 text-text-muted" size={20} />
                        </div>
                        {searchLink && linkAnalysisData.length > 0 && (
                            <button
                                onClick={() => handleExportImage(linkAnalysisRef, 'analyse_lien')}
                                className="p-3.5 bg-white border border-brand-border rounded-lg hover:bg-slate-50 transition-all text-text-primary shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
                                title="Exporter le graphique"
                            >
                                <ImageIcon size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {searchLink ? (
                    linkAnalysisData.length > 0 ? (
                        <div
                            ref={linkAnalysisRef}
                            id="export-link-analysis"
                            className="h-[450px] w-full relative p-8 rounded-xl bg-white border border-brand-border shadow-sm"
                        >
                            <div className="absolute top-6 right-8 bg-slate-50 border border-brand-border px-5 py-3 rounded-lg shadow-sm text-right z-10">
                                <span className="block text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-1">Visites Identifiées</span>
                                <span className="text-3xl font-black text-orange-primary">{linkAnalysisTotal}</span>
                            </div>
                            <div className="h-full w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={linkAnalysisData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#FF7900" />
                                                <stop offset="100%" stopColor="#cc6000" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#64748B"
                                            fontSize={11}
                                            fontWeight={600}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={0}
                                            angle={-35}
                                            textAnchor="end"
                                            height={100}
                                            dy={10}
                                        />
                                        <YAxis stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            content={<CustomTooltip />}
                                            cursor={{ fill: '#F8FAFC' }}
                                        />
                                        <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={45} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="min-h-[300px] flex flex-col items-center justify-center text-text-secondary bg-slate-50/50 rounded-xl border-2 border-dashed border-brand-border">
                            <div className="w-20 h-20 bg-white border border-brand-border rounded-full flex items-center justify-center mb-6 shadow-sm">
                                <Search size={40} className="text-slate-200" />
                            </div>
                            <p className="text-lg font-bold text-text-primary">Aucun résultat trouvé pour <span className="text-orange-primary font-black">"{searchLink}"</span></p>
                        </div>
                    )
                ) : (
                    <div className="min-h-[150px] bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center p-10 group hover:bg-emerald-100/50 transition-all">
                        <div className="flex items-center gap-4 text-emerald-700/80 group-hover:text-emerald-800 transition-colors">
                            <LinkIcon size={24} className="opacity-50" />
                            <p className="text-center font-bold text-sm tracking-tight uppercase">
                                Entrez un mot-clé ou une partie de l'URL ci-dessus pour lancer l'analyse par lien.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white border border-brand-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-10 border-b border-brand-border flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-slate-50/50">
                    <div>
                        <h3 className="text-2xl font-extrabold text-text-primary mb-2 tracking-tight">Détails des Visiteurs</h3>
                        <div className="flex items-center gap-3">
                            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></span>
                            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Affichage de {Math.min(visibleCount, (data.aggregatedVisits || []).length)} sur {(data.aggregatedVisits || []).length}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-brand-border text-text-primary hover:bg-slate-50 transition-all text-xs font-bold rounded-md shadow-sm"
                        >
                            <FileSpreadsheet size={18} className="text-emerald-600" />
                            Excel Complet
                        </button>
                        <button
                            onClick={handleExportByService}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-brand-border text-text-primary hover:bg-slate-50 transition-all text-xs font-bold rounded-md shadow-sm"
                        >
                            <FileSpreadsheet size={18} className="text-orange-primary" />
                            Par Service
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200">
                                {displayColumns.map((col, idx) => (
                                    <th key={idx} className="px-4 py-4 text-xs font-medium text-text-secondary whitespace-nowrap">{col.label}</th>
                                ))}
                                <th className="px-4 py-4 text-xs font-medium text-text-secondary whitespace-nowrap text-center">Dernière Visite</th>
                                <th className="px-4 py-4 text-xs font-medium text-text-secondary whitespace-nowrap min-w-[300px]">Parcours</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {(data.aggregatedVisits || []).slice(0, visibleCount).map((record, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-all group">
                                    {displayColumns.map((col, idx) => {
                                        const val = record.member[col.key] || '-';
                                        return (
                                            <td key={idx} className="px-4 py-4">
                                                {idx === 0 ? (
                                                    <div className="font-medium text-text-primary text-sm group-hover:text-orange-primary transition-colors">
                                                        {String(val)}
                                                    </div>
                                                ) : (
                                                    <span className="text-text-secondary text-sm">{String(val)}</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-xs font-medium text-text-secondary bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-block whitespace-nowrap">
                                            {String(record.lastVisit || '-')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-3">
                                            {record.visits.map((v, vIdx) => {
                                                const title = v.pageTitle || v.page || 'Page';
                                                const url = v.url || '#';

                                                return (
                                                    <div key={vIdx} className="flex gap-3 items-start group/link p-3 rounded-lg bg-slate-50/50 border border-transparent hover:border-brand-border hover:bg-white transition-all">
                                                        <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded bg-white border border-brand-border flex items-center justify-center text-text-muted transition-all">
                                                            <LinkIcon size={12} />
                                                        </div>
                                                        <div className="flex-grow min-w-0">
                                                            <div className="text-xs font-semibold text-text-primary mb-0.5 truncate max-w-[300px]" title={title}>
                                                                {title}
                                                            </div>
                                                            <a
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] text-text-secondary hover:text-orange-primary truncate block hover:underline"
                                                            >
                                                                {url}
                                                            </a>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {record.visitCount > record.visits.length && (
                                                <div className="text-[10px] text-text-muted italic px-3">
                                                    + {record.visitCount - record.visits.length} autres visites non affichées (limite de performance)
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {(data.aggregatedVisits || []).length > visibleCount && (
                    <div className="p-10 border-t border-white/5 text-center bg-white/[0.01]">
                        <button
                            onClick={() => setVisibleCount(prev => prev + 50)}
                            className="btn-primary flex items-center gap-3 px-8 shadow-lg active:scale-95 m-auto"
                        >
                            Voir plus (+50)
                        </button>
                        <div className="mt-12 text-center">
                            {activeBase && (
                                <p className="text-text-secondary text-[10px] font-bold uppercase tracking-widest opacity-60">
                                    Base active : <span className="text-text-primary px-2">{activeBase.name}</span> • {activeBase.data.length} membres
                                </p>
                            )}
                        </div>
                        <p className="text-secondary text-[10px] mt-4 font-bold uppercase tracking-widest opacity-60">
                            {(data.aggregatedVisits || []).length - visibleCount} restants à découvrir
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
