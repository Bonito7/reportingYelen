import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { HRBase } from './excelProcessor';

interface YelenDB extends DBSchema {
    hr_bases: {
        key: string;
        value: HRBase;
    };
    app_state: {
        key: string; // 'visitData', 'activeBaseId', etc.
        value: unknown;
    };
}

const DB_NAME = 'yelen_db';
const DB_VERSION = 1;

class DB {
    private dbPromise: Promise<IDBPDatabase<YelenDB>>;

    constructor() {
        this.dbPromise = openDB<YelenDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('hr_bases')) {
                    db.createObjectStore('hr_bases', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('app_state')) {
                    db.createObjectStore('app_state');
                }
            },
        });
    }

    async getAllHRBases(): Promise<HRBase[]> {
        const db = await this.dbPromise;
        return db.getAll('hr_bases');
    }

    async saveHRBase(base: HRBase): Promise<void> {
        const db = await this.dbPromise;
        await db.put('hr_bases', base);
    }

    async saveAllHRBases(bases: HRBase[]): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction('hr_bases', 'readwrite');
        // Clear existing and rewrite? Or just upsert?
        // Since this is a sync of the full state, we should probably be careful.
        // However, saving one by one is common. 
        // Let's rely on individual save or a smart sync if needed.
        // For simplicity with the React state, we'll iterate.
        // Actually, "setHrBases" in App replaces the array.
        // So we might want to clear and re-add if we want to mirror strictly,
        // OR just use 'put' to update existing ones.
        // BUT if a user deletes one in the UI, we need to delete it here too.
        // Strategy: Clear store and add all (simplest for sync).
        await tx.objectStore('hr_bases').clear();
        for (const base of bases) {
            await tx.objectStore('hr_bases').put(base);
        }
        await tx.done;
    }

    async deleteHRBase(id: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete('hr_bases', id);
    }

    async getAppState<T>(key: string): Promise<T | undefined> {
        const db = await this.dbPromise;
        return (await db.get('app_state', key)) as T | undefined;
    }

    async setAppState(key: string, value: unknown): Promise<void> {
        const db = await this.dbPromise;
        await db.put('app_state', value, key);
    }

    async clearAppState(key: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete('app_state', key);
    }
}

export const db = new DB();
