const API_URL = import.meta.env.VITE_API_URL || 'https://reportingyelenserver.onrender.com/api';
// Fallback local: 'http://localhost:5001/api'

export const api = {
    // HR Bases
    getAllHRBases: async () => {
        const res = await fetch(`${API_URL}/hr-bases`);
        if (!res.ok) throw new Error('Failed to fetch HR bases');
        return res.json();
    },

    syncHRBases: async (bases: any[]) => {
        const res = await fetch(`${API_URL}/hr-bases/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bases })
        });
        if (!res.ok) throw new Error('Failed to sync HR bases');
        return res.json();
    },

    // App State / Visit Data
    getState: async (key: string) => {
        const res = await fetch(`${API_URL}/state/${key}`);
        if (!res.ok) throw new Error('Failed to fetch state');
        return res.json();
    },

    updateState: async (key: string, value: any) => {
        const res = await fetch(`${API_URL}/state/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        if (!res.ok) throw new Error('Failed to update state');
        return res.json();
    },

    clearState: async (key: string) => {
        const res = await fetch(`${API_URL}/state/${key}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to clear state');
        return res.json();
    },

    analyzeVisites: async (file: File, hrBaseId: string, strictMode: boolean = true) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hrBaseId', hrBaseId);
        formData.append('strictMode', String(strictMode));

        const res = await fetch(`${API_URL}/process-visites`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Erreur lors de l\'analyse serveur');
        }

        return res.json();
    },

    uploadHRBase: async (file: File, name: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);

        const res = await fetch(`${API_URL}/hr-bases/upload`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Erreur lors de l\'upload HR');
        }

        return res.json();
    },

    getHRBaseSample: async (id: string) => {
        const res = await fetch(`${API_URL}/hr-bases/${id}/sample`);
        if (!res.ok) throw new Error('Failed to fetch sample');
        return res.json();
    },

    clearAllData: async () => {
        const res = await fetch(`${API_URL}/admin/clear-all`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Erreur lors de la suppression des données');
        }

        return res.json();
    }
};
