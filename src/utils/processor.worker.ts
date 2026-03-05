import * as XLSX from 'xlsx';
import { processAnalysis, mapHRData } from './excelProcessor';

let internalRawData: any[] | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { type, file, hrBase, dailyVisits, strictMode, rawData, selectedFields } = e.data;
    console.log(`Worker received task: ${type}`);

    try {
        if (type === 'PARSE_EXCEL') {
            const data = await parseExcelInWorker(file, (msg) => {
                self.postMessage({ type: 'PROGRESS', message: msg });
            });
            internalRawData = data;

            // Optimization: Get keys from first 50 rows and send back, not the whole data
            const allKeys = Array.from(new Set(data.slice(0, 50).flatMap((row: any) => row ? Object.keys(row) : []))) as string[];

            console.log(`Worker parsed Excel: ${data.length} rows. Sending keys only.`);
            self.postMessage({ type: 'PARSE_SUCCESS', keys: allKeys, rowCount: data.length });
        } else if (type === 'MAP_HR_DATA') {
            const sourceData = internalRawData || rawData;

            if (!sourceData) {
                throw new Error("Missing data for mapping");
            }

            const mappedData = mapHRData(sourceData, selectedFields, (msg) => {
                self.postMessage({ type: 'PROGRESS', message: msg });
            });
            self.postMessage({ type: 'MAP_SUCCESS', mappedData });
            // Cleanup after mapping as we probably don't need it anymore
            internalRawData = null;
        } else if (type === 'PROCESS_ANALYSIS' || type === 'PARSE_AND_PROCESS_VISITS') {
            let dataToProcess = dailyVisits;

            if (type === 'PARSE_AND_PROCESS_VISITS') {
                dataToProcess = await parseExcelInWorker(file, (msg) => {
                    self.postMessage({ type: 'PROGRESS', message: msg });
                });
            }

            if (!dataToProcess) {
                throw new Error("Missing data for analysis");
            }

            self.postMessage({ type: 'PROGRESS', message: "Calcul des statistiques..." });
            const result = processAnalysis(hrBase, dataToProcess, strictMode);
            self.postMessage({ type: 'ANALYSIS_SUCCESS', result });
        }
    } catch (error: any) {
        console.error(`Worker error: ${error.message}`);
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};

async function parseExcelInWorker(file: File, onProgress: (msg: string) => void): Promise<any[]> {
    try {
        onProgress("Lecture du fichier...");
        const buffer = await file.arrayBuffer();

        onProgress("Analyse Excel (cela peut prendre du temps)...");
        const workbook = XLSX.read(buffer, {
            type: 'array',
            cellDates: false, // Radical: Avoid creating thousands of Date objects
            cellNF: false,
            cellText: false,
            cellFormula: false
        });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        onProgress("Conversion en JSON...");
        return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    } catch (error) {
        throw error;
    }
}
