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

module.exports = {
    processAnalysis
};
