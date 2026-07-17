const SUBJECT_MAP = {
    'AV': 'Anh Văn',
    'T': 'Toán',
    'V': 'Ngữ Văn',
    'H': 'Hóa học',
    'L': 'Vật lý',
    'S': 'Sinh học',
    'SU': 'Lịch sử',
    'Ti': 'Tin học',
    'Đ': 'Địa lý'
};

export function getSubjectName(code) {
    return SUBJECT_MAP[code] || code;
}

export function getSubjectQuota(code) {
    const cleanCode = code.toUpperCase();
    if (cleanCode === 'T' || cleanCode === 'AV' || cleanCode === 'TOAN' || cleanCode === 'ANH') return 70;
    if (cleanCode === 'TI' || cleanCode === 'TIN' || cleanCode === 'SU' || cleanCode === 'Đ' || cleanCode === 'DIA') return 30;
    return 35;
}

export function getCompetitiveness(ratio) {
    if (ratio >= 3.0) return { label: 'Rất cao', class: 'badge-danger' };
    if (ratio >= 2.0) return { label: 'Cao', class: 'badge-warning' };
    if (ratio >= 1.0) return { label: 'Trung bình', class: 'badge-primary' };
    return { label: 'Thấp', class: 'badge-success' };
}

export function calculateOverallStats(students) {
    return {
        totalStudents: students.length,
        totalSubjects: new Set(students.map(s => s.subject)).size,
        totalSchools: new Set(students.map(s => s.school)).size,
        totalRooms: new Set(students.map(s => s.room)).size
    };
}

export function getTopLists(students, limit = 5) {
    const schoolCounts = {}, roomCounts = {}, subjectCounts = {};
    students.forEach(s => {
        if (s.school) schoolCounts[s.school] = (schoolCounts[s.school] || 0) + 1;
        if (s.room) roomCounts[s.room] = (roomCounts[s.room] || 0) + 1;
        if (s.subject) subjectCounts[s.subject] = (subjectCounts[s.subject] || 0) + 1;
    });

    return {
        topSchools: Object.entries(schoolCounts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count })),
        topRooms: Object.entries(roomCounts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count })),
        topSubjects: Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([code, count]) => ({ code, name: getSubjectName(code), count }))
    };
}

export function getBirthYearDistribution(students) {
    const years = {};
    students.forEach(s => {
        if (s.birthday) {
            const year = s.birthday.split('/')[2]?.trim() || 'Không rõ';
            years[year] = (years[year] || 0) + 1;
        }
    });
    return Object.entries(years).sort((a, b) => a[0].localeCompare(b[0])).map(([year, count]) => ({ year, count }));
}

export function getCompetitionStats(students) {
    const subjectGroups = {};
    students.forEach(s => s.subject && (subjectGroups[s.subject] = (subjectGroups[s.subject] || 0) + 1));

    return Object.entries(SUBJECT_MAP).map(([code, name]) => {
        const count = subjectGroups[code] || 0;
        const quota = getSubjectQuota(code);
        const ratio = quota > 0 ? parseFloat((count / quota).toFixed(2)) : 0;
        return { code, name, count, quota, ratio, competitiveness: getCompetitiveness(ratio) };
    }).sort((a, b) => b.ratio - a.ratio);
}

export function getSubjectDetailStats(students, subjectCode) {
    const subjectStudents = students.filter(s => s.subject === subjectCode);
    const total = subjectStudents.length;
    const quota = getSubjectQuota(subjectCode);
    const ratio = quota > 0 ? parseFloat((total / quota).toFixed(2)) : 0;

    const schoolCounts = {}, roomCounts = {};
    subjectStudents.forEach(s => {
        if (s.school) schoolCounts[s.school] = (schoolCounts[s.school] || 0) + 1;
        if (s.room) roomCounts[s.room] = (roomCounts[s.room] || 0) + 1;
    });

    return {
        code: subjectCode,
        name: getSubjectName(subjectCode),
        total,
        quota,
        ratio,
        classes: quota / 35,
        competitiveness: getCompetitiveness(ratio),
        topSchools: Object.entries(schoolCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        roomsCount: Object.keys(roomCounts).length,
        schoolsCount: Object.keys(schoolCounts).length,
        roomsBreakdown: Object.entries(roomCounts).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([name, count]) => ({ name, count })),
        students: subjectStudents
    };
}