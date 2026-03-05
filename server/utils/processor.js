const XLSX = require('xlsx');

const processAnalysis = (hrBase, dailyVisits, strictMode = true) => {
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

    const hrMap = new Map();
    hrBase.forEach((member) => {
        if (member && member.cuid) {
            const normalizedCuid = member.cuid.toString().toLowerCase().trim();
            if (normalizedCuid) {
                hrMap.set(normalizedCuid, member);
            }
        }
    });

    const visitsByPerimeter = {};
    const visitsByDirection = {};
    const visitsByService = {};
    const visitsByDepartment = {};
    const unknownCuids = new Set();
    const uniqueVisitors = new Set();
    const aggregatedMap = new Map();

    let matchedCount = 0;
    dailyVisits.forEach((visit) => {
        if (!visit) return;

        // Try to find a CUID in various common columns if it's raw data
        const cuid = (visit.cuid || visit.Login || visit.CUID || visit['User ID'] || visit['matricule'] || '').toString().toLowerCase().trim();
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
                    lastVisit: visit.date || visit.Date || '-'
                });
            }
            const agg = aggregatedMap.get(cuid);
            // Limit stored visits to 50 per user to keep payload manageable
            if (agg.visits.length < 50) {
                agg.visits.push({
                    cuid,
                    date: visit.date || visit.Date || '-',
                    page: visit.page || visit.Page || visit['Page consultée'] || '-',
                    url: visit.url || visit['url (actionDetails 0)'] || '-',
                    pageTitle: visit.pageTitle || visit['pageTitle (actionDetails 0)'] || '-'
                });
            }
            agg.visitCount++;
            agg.lastVisit = visit.date || visit.Date || '-';

        } else {
            if (!strictMode) {
                unknownCuids.add(cuid);
                uniqueVisitors.add(cuid);

                if (!aggregatedMap.has(cuid)) {
                    aggregatedMap.set(cuid, {
                        member: { cuid: cuid, perimeter: 'Non répertorié' },
                        visits: [],
                        visitCount: 0,
                        lastVisit: visit.date || visit.Date || '-'
                    });
                }
                const agg = aggregatedMap.get(cuid);
                if (agg.visits.length < 50) {
                    agg.visits.push({
                        cuid,
                        date: visit.date || visit.Date || '-',
                        page: visit.page || visit.Page || '-',
                    });
                }
                agg.visitCount++;
            }
        }
    });

    // Limit to top 1000 most active users for high performance
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

const mapHRData = (rawData, selectedFields) => {
    const result = [];

    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const member = {};

        const findVal = (potentialKeys) => {
            const key = Object.keys(row).find(k =>
                potentialKeys.includes(k.toLowerCase().trim())
            );
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

        // Selected dynamic fields
        if (selectedFields && selectedFields.length > 0) {
            selectedFields.forEach(field => {
                if (row[field] !== undefined) {
                    member[field] = row[field];
                }
            });
        }

        if (member.cuid) {
            // Final clean: only keep defined keys to save memory
            const cleanMember = {};
            Object.keys(member).forEach(k => {
                if (member[k] !== undefined && member[k] !== null && member[k] !== "") {
                    cleanMember[k] = member[k];
                }
            });
            result.push(cleanMember);
        }
    }

    return result;
};

module.exports = {
    processAnalysis,
    mapHRData
};
