import { fetchStudents, getSubjects } from './data.js';
import { updateBreadcrumb, updateActiveNavItem, getSkeletonHtml, showToast } from './ui.js';

const pageInitializers = {};
const templateCache = new Map();
const BASE_PATH = window.location.hostname.endsWith('github.io') ? '/tuyen-sinh-10' : '';

function stripBasePath(path) {
    if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
    return path || '/';
}

function withBasePath(path) {
    return `${BASE_PATH}${path === '/' ? '/' : path}`;
}

const ROUTE_MAP = {
    '/': 'dashboard',
    '/students': 'students',
    '/charts': 'charts',
    '/competition': 'competition',
    '/subjects': 'subjects',
    '/ranking': 'ranking',
};

export function registerPageInitializer(page, initFn) {
    pageInitializers[page] = initFn;
}

export function navigate(path) {
    const normalized = normalizePath(path);
    if (normalized === getCurrentPath()) {
        handleRoute();
        return;
    }
    window.history.pushState({ path: normalized }, '', withBasePath(normalized));
    handleRoute();
}

export function getCurrentPath() {
    return normalizePath(stripBasePath(window.location.pathname));
}

function normalizePath(path) {
    if (!path || path === '') return '/';
    let normalized = path.split('?')[0].split('#')[0];
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
}

function migrateLegacyHashRoute() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#/')) return false;
    const legacyPath = hash.replace('#', '') || '/';
    window.history.replaceState({ path: legacyPath }, '', withBasePath(legacyPath));
    return true;
}

function parseRoute(path) {
    if (ROUTE_MAP[path]) return { route: ROUTE_MAP[path], param: null, path };
    const subjectMatch = path.match(/^\/subjects\/([^/]+)$/i);
    if (subjectMatch) {
        const code = subjectMatch[1].toUpperCase();
        if (getSubjects().includes(code)) return { route: 'subject-detail', param: code, path: `/subjects/${code}` };
    }
    const legacyMatch = path.match(/^\/([^/]+)$/);
    if (legacyMatch) {
        const code = legacyMatch[1].toUpperCase();
        if (getSubjects().includes(code)) return { route: 'subject-detail', param: code, path: `/subjects/${code}` };
    }
    return null;
}

function setPageMeta(routeInfo) {
    const { route, param, path } = routeInfo;
    const meta = {
        'dashboard': { label: 'Tổng quan', link: '/' },
        'students': { label: 'Danh sách thí sinh', link: '/students' },
        'charts': { label: 'Biểu đồ phân tích', link: '/charts' },
        'competition': { label: 'Tỷ lệ chọi', link: '/competition' },
        'subjects': { label: 'Danh sách môn', link: '/subjects' },
        'ranking': { label: 'Xếp hạng tuyển sinh', link: '/ranking' }
    };
    if (route === 'subject-detail') {
        updateBreadcrumb([{ label: 'Danh sách môn', link: '/subjects' }, { label: param, link: path }]);
        updateActiveNavItem('/subjects');
    } else if (meta[route]) {
        updateBreadcrumb([meta[route]]);
        updateActiveNavItem(meta[route].link);
    }
}

async function loadTemplate(templatePath) {
    if (templateCache.has(templatePath)) return templateCache.get(templatePath);
    const response = await fetch(`${BASE_PATH}${templatePath}`);
    if (!response.ok) throw new Error(`Failed to load template ${templatePath}`);
    const html = await response.text();
    templateCache.set(templatePath, html);
    return html;
}

function interceptLinkClicks() {
    document.addEventListener('click', (event) => {
        const anchor = event.target.closest('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        if (href.startsWith('#')) {
            event.preventDefault();
            navigate(href.replace('#', '') || '/');
            return;
        }
        if (href.startsWith('/')) {
            event.preventDefault();
            navigate(href);
        }
    });
}

export async function initRouter() {
    migrateLegacyHashRoute();
    interceptLinkClicks();
    window.addEventListener('popstate', handleRoute);
    await handleRoute();
}

async function handleRoute() {
    const contentContainer = document.getElementById('content');
    if (!contentContainer) return;

    contentContainer.classList.add('page-exit');
    await new Promise(resolve => setTimeout(resolve, 250));

    contentContainer.innerHTML = getSkeletonHtml('table');
    contentContainer.classList.remove('page-exit');
    contentContainer.classList.add('page-enter');

    try {
        await fetchStudents();
    } catch (e) {
        contentContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3 class="empty-state-title">Đã xảy ra lỗi</h3></div>`;
        return;
    }

    const path = getCurrentPath();
    const routeInfo = parseRoute(path);

    if (!routeInfo) {
        window.history.replaceState({ path: '/' }, '', withBasePath('/'));
        await handleRoute();
        return;
    }

    setPageMeta(routeInfo);

    try {
        const { route, param } = routeInfo;
        if (route === 'students') {
            renderStudentsPage(contentContainer);
            pageInitializers.students?.(null);
        } else {
            const templates = { 'dashboard': '/dashboardd.html', 'charts': '/chartss.html', 'competition': '/competitionn.html', 'ranking': '/rankingg.html', 'subject-detail': '/subjectt.html', 'subjects': '/subjectt.html' };
            const html = await loadTemplate(templates[route]);
            contentContainer.innerHTML = html;
            pageInitializers[route]?.(param);
        }
        requestAnimationFrame(() => contentContainer.classList.remove('page-enter'));
    } catch (err) {
        contentContainer.innerHTML = `<div class="empty-state"><h3>Lỗi tải trang</h3><p>${err.message}</p></div>`;
    }
}

function renderStudentsPage(container) {
    container.innerHTML = `
        <div class="fade-in">
            <div class="page-header-row">
                <div><h1 class="page-title">Danh sách thí sinh</h1></div>
                <div class="student-count-badge" id="student-count-badge"><span>—</span> thí sinh</div>
            </div>
            <div class="data-panel">
                <div class="filter-bar">
                    <select id="filter-subject" class="filter-select"><option value="">Lọc theo Môn</option></select>
                    <select id="filter-school" class="filter-select"><option value="">Lọc theo Trường</option></select>
                    <select id="filter-room" class="filter-select"><option value="">Lọc theo Phòng</option></select>
                    <button id="btn-reset-filters" class="btn-secondary"><i class="fas fa-redo"></i></button>
                </div>
                <table id="students-table" class="table"><thead><tr><th>STT</th><th>Môn</th><th>SBD</th><th>Họ tên</th><th>Tổng</th></tr></thead><tbody></tbody></table>
            </div>
        </div>
    `;
}