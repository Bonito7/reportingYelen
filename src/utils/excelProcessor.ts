import * as XLSX from 'xlsx';

export interface HRMember {
  cuid: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  direction?: string;
  department?: string;
  service?: string;
  perimeter: string;
  jobTitle?: string;
  supervisor?: string;
  n1?: string;
  n2?: string;
  email?: string;
  [key: string]: any; // Allow dynamic fields
}

export interface HRBase {
  id: string;
  name: string;
  data: HRMember[];
  displayFields: { key: string; label: string }[];
}

export interface VisitRecord {
  cuid: string;
  date: string;
  page?: string;
  url?: string;
  pageTitle?: string;
}

export interface AggregatedVisit {
  member: HRMember | Partial<HRMember>;
  visits: VisitRecord[];
  visitCount: number;
  lastVisit: string;
}

export interface AnalysisResult {
  totalVisits: number;
  uniqueVisitors: number;
  visitsByPerimeter: Record<string, number>;
  visitsByDirection: Record<string, number>;
  visitsByService: Record<string, number>;
  visitsByDepartment: Record<string, number>;
  aggregatedVisits: AggregatedVisit[];
  unknownCuids: string[];
}

export const STANDARD_FIELDS = [
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

export const mapHRData = (rawData: any[], selectedFields: string[], onProgress?: (msg: string) => void): HRMember[] => {
  const total = rawData.length;
  const result: HRMember[] = [];

  for (let i = 0; i < total; i++) {
    const row = rawData[i];
    const member: any = {};

    const findVal = (potentialKeys: string[]) => {
      const key = Object.keys(row).find(k => potentialKeys.includes(k.toLowerCase().trim()));
      return key ? row[key] : undefined;
    };

    // System mappings
    member.cuid = row.Login || row.CUID || row['Code Utilisateur'] || row.Identifiant || findVal(['login', 'cuid', 'code utilisateur', 'identifiant']);
    member.perimeter = row.Périmètre || row.Perimeter || row.Secteur || findVal(['périmètre', 'perimetre', 'perimeter', 'secteur']);

    // Optional system fields
    member.direction = row.Direction || row.DR || findVal(['direction', 'dr']);
    member.department = row.Département || row.Dept || findVal(['département', 'departement', 'dept']);
    member.service = row.Service || row.Serv || findVal(['service', 'serv']);

    member.lastName = row.Nom || row.Surname || findVal(['nom', 'surname']);
    member.firstName = row.Prénoms || row.Prenom || row.Firstname || findVal(['prénoms', 'prenom', 'firstname']);
    member.name = row.Nom_Prenom || row.Fullname || findVal(['nom_prenom', 'fullname', 'nom et prénoms']);

    member.jobTitle = row.Fonction || row.Poste || row.Job || findVal(['fonction', 'poste', 'job']);
    member.supervisor = row['RA/Superviseur'] || row.Superviseur || row.Supervisor || row.RA || findVal(['ra/superviseur', 'superviseur', 'supervisor', 'ra']);

    member.n1 = row['N+1'] || row.N1 || findVal(['n+1', 'n1']);
    member.n2 = row['N+2'] || row.N2 || findVal(['n+2', 'n2']);
    member.email = row['Adresse Mail'] || row.Email || row.Mail || findVal(['adresse mail', 'email', 'mail']);

    // Selected dynamic fields - Strict: only if defined in selectedFields
    selectedFields.forEach(field => {
      if (row[field] !== undefined) {
        member[field] = row[field];
      }
    });

    if (member.cuid) {
      // Final clean: only keep defined keys to save memory
      const cleanMember: any = {};
      Object.keys(member).forEach(k => {
        if (member[k] !== undefined && member[k] !== null && member[k] !== "") {
          cleanMember[k] = member[k];
        }
      });
      result.push(cleanMember as HRMember);
    }

    if (onProgress && (i % 5000 === 0 || i === total - 1)) {
      onProgress(`Mapping des données: ${i + 1}/${total}`);
    }
  }

  return result;
};

export const parseExcel = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const processAnalysis = (
  hrBase: HRMember[] | null | undefined,
  dailyVisits: VisitRecord[] | null | undefined,
  strictMode: boolean = true
): AnalysisResult => {
  if (!hrBase || !dailyVisits) {
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      visitsByPerimeter: {},
      visitsByDirection: {},
      visitsByService: {},
      visitsByDepartment: {},
      aggregatedVisits: [],
      unknownCuids: [],
    };
  }

  const hrMap = new Map<string, HRMember>();
  hrBase.forEach((member) => {
    if (member && member.cuid) {
      const normalizedCuid = member.cuid.toString().toLowerCase().trim();
      if (normalizedCuid) {
        hrMap.set(normalizedCuid, member);
      }
    }
  });

  console.log("HR Map size:", hrMap.size);

  const visitsByPerimeter: Record<string, number> = {};
  const visitsByDirection: Record<string, number> = {};
  const visitsByService: Record<string, number> = {};
  const visitsByDepartment: Record<string, number> = {};
  const unknownCuids: Set<string> = new Set();
  const uniqueVisitors: Set<string> = new Set();
  const aggregatedMap = new Map<string, AggregatedVisit>();

  let matchedCount = 0;
  dailyVisits.forEach((visit) => {
    if (!visit || !visit.cuid) return;

    const cuid = visit.cuid.toString().toLowerCase().trim();
    if (!cuid) return;

    const member = hrMap.get(cuid);

    if (member) {
      matchedCount++;
      uniqueVisitors.add(cuid);

      const perimeter = member.perimeter || 'Inconnu';
      const direction = member.direction || 'Inconnu';
      const service = member.service || 'Inconnu';
      const department = member.department || 'Inconnu';

      visitsByPerimeter[perimeter] = (visitsByPerimeter[perimeter] || 0) + 1;
      visitsByDirection[direction] = (visitsByDirection[direction] || 0) + 1;
      visitsByService[service] = (visitsByService[service] || 0) + 1;
      visitsByDepartment[department] = (visitsByDepartment[department] || 0) + 1;

      if (!aggregatedMap.has(cuid)) {
        aggregatedMap.set(cuid, {
          member: member,
          visits: [],
          visitCount: 0,
          lastVisit: visit.date
        });
      }
      const agg = aggregatedMap.get(cuid)!;
      // Cap visits at 50 to avoid massive memory usage per user
      if (agg.visits.length < 50) {
        agg.visits.push(visit);
      }
      agg.visitCount++;
      agg.lastVisit = visit.date;

    } else {
      if (!strictMode) {
        unknownCuids.add(cuid);
        uniqueVisitors.add(cuid);

        if (!aggregatedMap.has(cuid)) {
          aggregatedMap.set(cuid, {
            member: { cuid: cuid, perimeter: 'Non répertorié' },
            visits: [],
            visitCount: 0,
            lastVisit: visit.date
          });
        }
        const agg = aggregatedMap.get(cuid)!;
        if (agg.visits.length < 50) {
          agg.visits.push(visit);
        }
        agg.visitCount++;
        agg.lastVisit = visit.date;
      }
    }
  });

  console.log(`Matching results: ${matchedCount} matched members in strict mode: ${strictMode}`);

  // TRUNCATION: Limit total payload size by only taking top users (e.g., 1000 most active)
  let aggregatedVisits = Array.from(aggregatedMap.values());
  if (aggregatedVisits.length > 1000) {
    aggregatedVisits = aggregatedVisits
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 1000);
  }

  return {
    totalVisits: matchedCount,
    uniqueVisitors: uniqueVisitors.size,
    visitsByPerimeter,
    visitsByDirection,
    visitsByService,
    visitsByDepartment,
    aggregatedVisits,
    unknownCuids: Array.from(unknownCuids),
  };
};
