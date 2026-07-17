let cachedStudents = null;
let subjectsList = [];
let schoolsList = [];
let roomsList = [];
let isDataLoading = false;
const CACHE_KEY = 'exam-analytics-students-v1';

function buildIndexes(data) {
    subjectsList = [...new Set(data.map(s => s.subject))].filter(Boolean).sort();
    schoolsList = [...new Set(data.map(s => s.school))].filter(Boolean).sort();
    roomsList = [...new Set(data.map(s => s.room))].filter(Boolean).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
}

function loadFromSessionCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveToSessionCache(data) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
}

export async function fetchStudents() {
    if (cachedStudents) return cachedStudents;
    if (isDataLoading) return null;

    isDataLoading = true;
    
    const sessionData = loadFromSessionCache();
    if (sessionData) {
        cachedStudents = sessionData;
        buildIndexes(cachedStudents);
        isDataLoading = false;
        return cachedStudents;
    }

    try {
        const response = await fetch('data/students.json');
        if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
        const data = await response.json();

        cachedStudents = data;
        saveToSessionCache(data);
        buildIndexes(data);
        return cachedStudents;
    } catch (error) {
        if (cachedStudents) return cachedStudents;
        throw error;
    } finally {
        isDataLoading = false;
    }
}

export function getStudents() {
    return cachedStudents || [];
}

export function getSubjects() {
    return subjectsList;
}

export function getSchools() {
    return schoolsList;
}

export function getRooms() {
    return roomsList;
}