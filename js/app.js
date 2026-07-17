/**
 * App Module
 * Main entry point of the application. Integrates data, stats, router, templates,
 * and page-specific handlers (Dashboard, Students, Charts, Competition).
 */

import { fetchStudents, getStudents, getSubjects, getSchools, getRooms } from './data.js';
import {
    calculateOverallStats,
    getTopLists,
    getBirthYearDistribution,
    getCompetitionStats,
    getSubjectName,
    getSubjectQuota,
    getCompetitiveness
} from './stats.js';
import { initRouter, registerPageInitializer } from './router.js';
import {
    initTheme,
    toggleTheme,
    initSidebar,
    animateCounter,
    showToast,
    showModal,
    closeModal
} from './ui.js';
import { matchQuery, debounce } from './search.js';
import {
    renderBarChart,
    renderHorizontalBarChart,
    renderPieChart,
    setupChartDownload,
    destroyAllCharts
} from './charts.js';
import { initSubjectListPage, initSubjectDetailPage } from './subject.js';

// ── Application Initialization ──
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();

    // Wire theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = () => toggleTheme();
    }

    try {
        // Fetch raw data
        await fetchStudents();

        // Setup shared navigation components
        initSidebar();
        initGlobalSearch();

        // Register page initializers before launching router
        registerPageInitializer('dashboard', initDashboardPage);
        registerPageInitializer('students', initStudentsPage);
        registerPageInitializer('charts', initChartsPage);
        registerPageInitializer('competition', initCompetitionPage);
        registerPageInitializer('subjects', (param) => initSubjectListPage());
        registerPageInitializer('subject-detail', (code) => initSubjectDetailPage(code));
        registerPageInitializer('ranking', initRankingPage);

        // Start Router
        await initRouter();

    } catch (err) {
        console.error('Core init failure:', err);
    }
});

// ── Dashboard Page Initializer ──
function initDashboardPage() {
    destroyAllCharts();
    const students = getStudents();
    const overall = calculateOverallStats(students);
    const topData = getTopLists(students, 5);

    // Animate summary counters
    animateCounter(document.getElementById('stat-total-students'), overall.totalStudents);
    animateCounter(document.getElementById('stat-total-subjects'), overall.totalSubjects);
    animateCounter(document.getElementById('stat-total-schools'), overall.totalSchools);
    animateCounter(document.getElementById('stat-total-rooms'), overall.totalRooms);

    // Render top lists
    const topSchoolsContainer = document.getElementById('top-schools-list');
    if (topSchoolsContainer) {
        topSchoolsContainer.innerHTML = topData.topSchools.map((s, idx) => `
            <li class="top-list-item">
                <span class="top-list-rank">${idx + 1}</span>
                <span class="top-list-name">${s.name}</span>
                <span class="top-list-value">${s.count} HS</span>
            </li>
        `).join('');
    }

    const topRoomsContainer = document.getElementById('top-rooms-list');
    if (topRoomsContainer) {
        topRoomsContainer.innerHTML = topData.topRooms.map((r, idx) => `
            <li class="top-list-item">
                <span class="top-list-rank">${idx + 1}</span>
                <span class="top-list-name">Phòng ${r.name}</span>
                <span class="top-list-value">${r.count} HS</span>
            </li>
        `).join('');
    }

    const topSubjectsContainer = document.getElementById('top-subjects-list');
    if (topSubjectsContainer) {
        topSubjectsContainer.innerHTML = topData.topSubjects.map((sb, idx) => `
            <li class="top-list-item">
                <span class="top-list-rank">${idx + 1}</span>
                <span class="top-list-name">${sb.name} (${sb.code})</span>
                <span class="top-list-value">${sb.count} HS</span>
            </li>
        `).join('');
    }

    // Load Overview Chart
    const statsList = getCompetitionStats(students);
    const subLabels = statsList.map(s => s.name);
    const subCounts = statsList.map(s => s.count);

    renderBarChart('dashboard-overview-chart', subLabels, subCounts, 'Số thí sinh đăng ký');
    setupChartDownload('dashboard-overview-chart', 'dl-dash-chart', 'tong_quan_mon_thi.png');

    // Competition insights
    const compStats = getCompetitionStats(students);
    const highest = compStats[0];
    const lowest = compStats[compStats.length - 1];
    const avgRatio = compStats.length
        ? (compStats.reduce((sum, s) => sum + s.ratio, 0) / compStats.length).toFixed(2)
        : '0';

    const insightContainer = document.getElementById('dashboard-insights');
    if (insightContainer) {
        insightContainer.innerHTML = `
            <div class="insight-chip">
                <div class="insight-chip-label">Môn cạnh tranh cao nhất</div>
                <div class="insight-chip-value text-danger">${highest.name}</div>
                <div class="text-tertiary" style="font-size: 12px;">${highest.ratio} : 1 • ${highest.count} thí sinh</div>
            </div>
            <div class="insight-chip">
                <div class="insight-chip-label">Môn cạnh tranh thấp nhất</div>
                <div class="insight-chip-value text-success">${lowest.name}</div>
                <div class="text-tertiary" style="font-size: 12px;">${lowest.ratio} : 1 • ${lowest.count} thí sinh</div>
            </div>
            <div class="insight-chip">
                <div class="insight-chip-label">Tỷ lệ chọi trung bình</div>
                <div class="insight-chip-value">${avgRatio} : 1</div>
                <div class="text-tertiary" style="font-size: 12px;">Trên ${compStats.length} môn chuyên</div>
            </div>
            <div class="insight-chip">
                <div class="insight-chip-label">TB thí sinh / môn</div>
                <div class="insight-chip-value">${Math.round(overall.totalStudents / Math.max(overall.totalSubjects, 1))}</div>
                <div class="text-tertiary" style="font-size: 12px;">${overall.totalStudents} thí sinh tổng</div>
            </div>
        `;
    }
}

// ── Students List Page Initializer ──
let studentsFilterFn = null;

function initStudentsPage() {
    destroyAllCharts();
    const students = getStudents();
    const subjects = getSubjects();
    const schools = getSchools();
    const rooms = getRooms();

    const countBadge = document.getElementById('student-total-count');
    if (countBadge) {
        countBadge.textContent = students.length.toLocaleString('vi-VN');
    }

    // Populate dropdown filters
    const filterSub = document.getElementById('filter-subject');
    const filterSch = document.getElementById('filter-school');
    const filterRm = document.getElementById('filter-room');

    if (filterSub) {
        filterSub.innerHTML = '<option value="">Lọc theo Môn</option>' +
            subjects.map(s => `<option value="${s}">${getSubjectName(s)} (${s})</option>`).join('');
    }
    if (filterSch) {
        filterSch.innerHTML = '<option value="">Lọc theo Trường</option>' +
            schools.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    if (filterRm) {
        filterRm.innerHTML = '<option value="">Lọc theo Phòng</option>' +
            rooms.map(r => `<option value="${r}">${r}</option>`).join('');
    }

    const tableEl = $('#students-table');
    let dt = null;

    const activeFilters = {
        subject: '',
        school: '',
        room: '',
        search: '',
    };

    if ($.fn.DataTable) {
        if ($.fn.DataTable.isDataTable('#students-table')) {
            $('#students-table').DataTable().destroy();
        }

        if (studentsFilterFn) {
            const idx = $.fn.dataTable.ext.search.indexOf(studentsFilterFn);
            if (idx !== -1) $.fn.dataTable.ext.search.splice(idx, 1);
        }

        studentsFilterFn = (settings, data, dataIndex) => {
            if (settings.nTable.id !== 'students-table') return true;

            const item = students[dataIndex];
            if (!item) return true;

            if (activeFilters.subject && item.subject !== activeFilters.subject) return false;
            if (activeFilters.school && item.school !== activeFilters.school) return false;
            if (activeFilters.room && item.room !== activeFilters.room) return false;

            if (activeFilters.search) {
                const searchPool = `${item.name} ${item.sbd} ${item.school} ${item.room} ${getSubjectName(item.subject)}`;
                if (!matchQuery(searchPool, activeFilters.search)) return false;
            }

            return true;
        };

        $.fn.dataTable.ext.search.push(studentsFilterFn);

        dt = tableEl.DataTable({
            data: students,
            columns: [
                { data: 'stt' },
                {
                    data: 'subject',
                    render: (data) => `${getSubjectName(data)} (${data})`,
                },
                { data: 'sbd' },
                { data: 'name' },
                { data: 'birthday' },
                { data: 'school' },
                { data: 'room' },
                {
                    data: 'van',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'toan',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'anh',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'chuyen',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'tong',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
            ],
            lengthMenu: [
                [25, 50, 100, 250, -1],
                [25, 50, 100, 250, 'Tất cả'],
            ],
            pageLength: -1,
            language: {
                search: 'Tìm nhanh:',
                lengthMenu: 'Hiển thị _MENU_ bản ghi',
                info: 'Hiển thị từ _START_ đến _END_ trong tổng số _TOTAL_ thí sinh',
                infoFiltered: '(lọc từ _MAX_ thí sinh)',
                zeroRecords: 'Không tìm thấy thí sinh phù hợp',
                paginate: {
                    first: 'Đầu',
                    last: 'Cuối',
                    next: 'Sau',
                    previous: 'Trước',
                },
            },
            responsive: true,
            order: [[0, 'asc']],
            dom: 'lfrtip',
            deferRender: true,
            fnRowCallback(nRow, aData) {
                $(nRow).on('click', () => {
                    openStudentDetailsModal(aData);
                });
            },
        });

        const triggerFilters = () => {
            activeFilters.subject = filterSub?.value || '';
            activeFilters.school = filterSch?.value || '';
            activeFilters.room = filterRm?.value || '';
            dt.draw();
            updateFilteredCount(dt);
        };

        const updateFilteredCount = (table) => {
            const badge = document.getElementById('student-total-count');
            if (!badge) return;
            const filtered = table.rows({ search: 'applied' }).count();
            const total = students.length;
            badge.textContent = filtered === total
                ? total.toLocaleString('vi-VN')
                : `${filtered.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')}`;
        };

        if (filterSub) filterSub.onchange = triggerFilters;
        if (filterSch) filterSch.onchange = triggerFilters;
        if (filterRm) filterRm.onchange = triggerFilters;

        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (filterSub) filterSub.value = '';
                if (filterSch) filterSch.value = '';
                if (filterRm) filterRm.value = '';
                activeFilters.search = '';
                const searchInput = document.querySelector('.dataTables_filter input');
                if (searchInput) searchInput.value = '';
                triggerFilters();
            };
        }

        const searchInput = document.querySelector('.dataTables_filter input');
        if (searchInput) {
            $(searchInput).unbind();
            searchInput.oninput = debounce((e) => {
                activeFilters.search = e.target.value.trim();
                dt.draw();
                updateFilteredCount(dt);
            }, 150);
        }

        updateFilteredCount(dt);
    }

    // Bind Exports
    const btnCSV = document.getElementById('export-csv');
    const btnExcel = document.getElementById('export-excel');
    const btnPrint = document.getElementById('export-print');

    if (btnCSV) btnCSV.onclick = () => exportStudentsData(dt ? dt.rows({ search: 'applied' }).data().toArray() : students, 'csv');
    if (btnExcel) btnExcel.onclick = () => exportStudentsData(dt ? dt.rows({ search: 'applied' }).data().toArray() : students, 'excel');
    if (btnPrint) btnPrint.onclick = () => printStudentsData(dt ? dt.rows({ search: 'applied' }).data().toArray() : students);
}

// ── General Charts Page Initializer ──
function initChartsPage() {
    destroyAllCharts();
    const students = getStudents();

    // Chart 1: Subject Counts (Bar)
    const statsList = getCompetitionStats(students);
    const subLabels = statsList.map(s => s.name);
    const subCounts = statsList.map(s => s.count);
    renderBarChart('chart-subjects-bar', subLabels, subCounts, 'Số thí sinh');
    setupChartDownload('chart-subjects-bar', 'dl-c1', 'phan_bo_mon_thi.png');

    // Chart 2: Subjects ratio (Pie/Doughnut)
    renderPieChart('chart-subjects-pie', subLabels, subCounts);
    setupChartDownload('chart-subjects-pie', 'dl-c2', 'ti_le_mon_thi.png');

    // Chart 3: Top 15 Schools (Horizontal Bar)
    const topData = getTopLists(students, 15);
    const schoolLabels = topData.topSchools.map(s => s.name.replace('Trường THCS ', '').replace('Trường ', ''));
    const schoolCounts = topData.topSchools.map(s => s.count);
    renderHorizontalBarChart('chart-schools-bar', schoolLabels, schoolCounts, 'Số thí sinh');
    setupChartDownload('chart-schools-bar', 'dl-c3', 'top_15_truong_dong_hoc_sinh.png');

    // Chart 4: Top Rooms (Bar)
    const roomLabels = topData.topRooms.map(r => `P.${r.name}`);
    const roomCounts = topData.topRooms.map(r => r.count);
    renderBarChart('chart-rooms-bar', roomLabels, roomCounts, 'Số học sinh');
    setupChartDownload('chart-rooms-bar', 'dl-c4', 'top_phong_thi_dong_nhat.png');

    // Chart 5: Birth year distribution (Bar)
    const birthData = getBirthYearDistribution(students);
    const birthLabels = birthData.map(b => `Năm ${b.year}`);
    const birthCounts = birthData.map(b => b.count);
    renderBarChart('chart-birth-bar', birthLabels, birthCounts, 'Số thí sinh');
    setupChartDownload('chart-birth-bar', 'dl-c5', 'phan_bo_nam_sinh.png');
}

// ── Competition Page Initializer ──
function initCompetitionPage() {
    destroyAllCharts();
    const students = getStudents();
    const compStats = getCompetitionStats(students);

    // Cards details
    const highest = compStats[0];
    const lowest = compStats[compStats.length - 1];

    const hCard = document.getElementById('highest-comp-card');
    if (hCard) {
        hCard.innerHTML = `
            <div class="stat-card" style="border-left: 4px solid var(--danger);">
                <div class="stat-card-label">Môn cạnh tranh cao nhất</div>
                <div class="stat-card-value text-danger" style="font-size: var(--font-size-md)">${highest.name}</div>
                <div class="stat-card-change" style="font-size: 14px;"><strong>Tỉ lệ chọi: ${highest.ratio} : 1</strong></div>
                <div class="text-tertiary mt-1" style="font-size: 11px;">Số ĐK: ${highest.count} / Chỉ tiêu: ${highest.quota}</div>
            </div>
        `;
    }

    const lCard = document.getElementById('lowest-comp-card');
    if (lCard) {
        lCard.innerHTML = `
            <div class="stat-card" style="border-left: 4px solid var(--success);">
                <div class="stat-card-label">Môn cạnh tranh thấp nhất</div>
                <div class="stat-card-value text-success" style="font-size: var(--font-size-md)">${lowest.name}</div>
                <div class="stat-card-change" style="font-size: 14px;"><strong>Tỉ lệ chọi: ${lowest.ratio} : 1</strong></div>
                <div class="text-tertiary mt-1" style="font-size: 11px;">Số ĐK: ${lowest.count} / Chỉ tiêu: ${lowest.quota}</div>
            </div>
        `;
    }

    // Build Table Body
    const tbody = document.getElementById('competition-table-body');
    if (tbody) {
        tbody.innerHTML = compStats.map((item, idx) => {
            return `
                <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td><a href="/subjects/${item.code}" class="fw-bold">${item.name} (${item.code})</a></td>
                    <td>${item.count}</td>
                    <td>${item.quota}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <span>${item.ratio} : 1</span>
                            <span class="badge ${item.competitiveness.class}">${item.competitiveness.label}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Draw comparison maps
    const subLabels = compStats.map(s => s.name);
    const subRatios = compStats.map(s => s.ratio);
    renderBarChart('competition-compare-bar', subLabels, subRatios, 'Tỷ lệ chọi');
    setupChartDownload('competition-compare-bar', 'dl-comp-bar', 'ti_le_choi_so_sanh.png');
}

// ── Global Search Box Logic ──
function initGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const dropdown = document.getElementById('search-dropdown');
    if (!input || !dropdown) return;

    let highlightedIndex = -1;
    let suggestions = [];

    // Document click closer
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    const searchAction = debounce(() => {
        const query = input.value.trim();
        if (!query) {
            dropdown.classList.remove('show');
            return;
        }

        const students = getStudents();
        suggestions = students.filter(s => {
            const pool = `${s.name} ${s.sbd} ${s.school} ${s.room} ${getSubjectName(s.subject)}`;
            return matchQuery(pool, query);
        }).slice(0, 8); // top 8 results

        if (suggestions.length === 0) {
            dropdown.innerHTML = `
                <div class="search-result-item text-muted">Không tìm thấy thí sinh nào</div>
            `;
        } else {
            dropdown.innerHTML = suggestions.map((s, idx) => `
                <div class="search-result-item" data-index="${idx}">
                    <div>
                        <div class="result-name"><strong>${s.name}</strong> <span class="badge badge-info ms-2">${s.sbd}</span></div>
                        <div class="result-meta">${s.school} • Phòng ${s.room} • Chuyên ${getSubjectName(s.subject)}</div>
                    </div>
                </div>
            `).join('');

            // Click handlers
            dropdown.querySelectorAll('.search-result-item').forEach(item => {
                item.onclick = () => {
                    const idx = parseInt(item.getAttribute('data-index'));
                    if (suggestions[idx]) {
                        openStudentDetailsModal(suggestions[idx]);
                        dropdown.classList.remove('show');
                        input.value = '';
                    }
                };
            });
        }

        highlightedIndex = -1;
        dropdown.classList.add('show');
    }, 150);

    input.oninput = searchAction;
    input.onfocus = () => {
        if (input.value.trim()) dropdown.classList.add('show');
    };

    // Keyboard navigation
    input.onkeydown = (e) => {
        const items = dropdown.querySelectorAll('.search-result-item');
        if (!dropdown.classList.contains('show') || items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = (highlightedIndex + 1) % items.length;
            updateHighlighting(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
            updateHighlighting(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                openStudentDetailsModal(suggestions[highlightedIndex]);
                dropdown.classList.remove('show');
                input.value = '';
            }
        }
    };

    function updateHighlighting(items) {
        items.forEach((item, idx) => {
            if (idx === highlightedIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }
}

// ── Profile Detail Dialog Render Helper ──
function openStudentDetailsModal(student) {
    const textTones = getSubjectName(student.subject);
    const quota = getSubjectQuota(student.subject);
    const html = `
        <div class="modal-detail-row">
            <span class="modal-detail-label">Họ tên</span>
            <span class="modal-detail-value">${student.name}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Số báo danh</span>
            <span class="modal-detail-value"><strong>${student.sbd}</strong></span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Ngày sinh</span>
            <span class="modal-detail-value">${student.birthday}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Môn đăng ký</span>
            <span class="modal-detail-value">${textTones} (${student.subject})</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Phòng thi</span>
            <span class="modal-detail-value">${student.room}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Trường THCS</span>
            <span class="modal-detail-value">${student.school}</span>
        </div>
        <div class="modal-detail-divider" style="margin: 15px 0; border-top: 1px dashed rgba(255,255,255,.12);"></div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Điểm Ngữ Văn</span>
            <span class="modal-detail-value">${student.van !== null && student.van !== undefined ? student.van : '—'}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Điểm Toán</span>
            <span class="modal-detail-value">${student.toan !== null && student.toan !== undefined ? student.toan : '—'}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Điểm Anh Văn</span>
            <span class="modal-detail-value">${student.anh !== null && student.anh !== undefined ? student.anh : '—'}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Điểm Chuyên (hệ số 2)</span>
            <span class="modal-detail-value">${student.chuyen !== null && student.chuyen !== undefined ? student.chuyen : '—'}</span>
        </div>
        <div class="modal-detail-row highlight" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; font-weight: bold; margin-top: 8px;">
            <span class="modal-detail-label">Tổng điểm xét tuyển</span>
            <span class="modal-detail-value fs-5" style="color: var(--accent-primary);">${student.tong !== null && student.tong !== undefined ? student.tong : '—'}</span>
        </div>
    `;
    showModal('Thẻ thông tin thí sinh', html);
}

// ── Export/Print helpers for main students database table ──
function exportStudentsData(data, type) {
    if (type === 'csv') {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "STT,Môn,SBD,Họ tên,Ngày sinh,Trường,Phòng,Văn,Toán,Anh,Chuyên,Tổng\n";
        data.forEach(s => {
            const row = [
                s.stt,
                getSubjectName(s.subject),
                s.sbd,
                s.name,
                s.birthday,
                s.school,
                s.room,
                s.van !== null && s.van !== undefined ? s.van : '—',
                s.toan !== null && s.toan !== undefined ? s.toan : '—',
                s.anh !== null && s.anh !== undefined ? s.anh : '—',
                s.chuyen !== null && s.chuyen !== undefined ? s.chuyen : '—',
                s.tong !== null && s.tong !== undefined ? s.tong : '—'
            ];
            csvContent += row.map(val => `"${val}"`).join(",") + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "danh_sach_thi_sinh.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Xuất tệp CSV thành công!', 'success');
    } else if (type === 'excel') {
        let excelContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"/></head>
            <body>
            <table>
                <tr>
                    <th>STT</th><th>Môn thi</th><th>SBD</th><th>Họ tên</th><th>Ngày sinh</th><th>Trường</th><th>Phòng</th><th>Văn</th><th>Toán</th><th>Anh</th><th>Chuyên</th><th>Tổng</th>
                </tr>
        `;
        data.forEach(s => {
            excelContent += `
                <tr>
                    <td>${s.stt}</td>
                    <td>${getSubjectName(s.subject)}</td>
                    <td>${s.sbd}</td>
                    <td>${s.name}</td>
                    <td>${s.birthday}</td>
                    <td>${s.school}</td>
                    <td>${s.room}</td>
                    <td>${s.van !== null && s.van !== undefined ? s.van : '—'}</td>
                    <td>${s.toan !== null && s.toan !== undefined ? s.toan : '—'}</td>
                    <td>${s.anh !== null && s.anh !== undefined ? s.anh : '—'}</td>
                    <td>${s.chuyen !== null && s.chuyen !== undefined ? s.chuyen : '—'}</td>
                    <td>${s.tong !== null && s.tong !== undefined ? s.tong : '—'}</td>
                </tr>
            `;
        });
        excelContent += `</table></body></html>`;

        const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = "danh_sach_thi_sinh.xls";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Xuất tệp Excel thành công!', 'success');
    }
}

function printStudentsData(data) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>In Danh Sách Thí Sinh</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body onload="window.print();window.close();">
            <h1>DANH SÁCH THÍ SINH KỲ THI CHUYÊN</h1>
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Môn</th>
                        <th>SBD</th>
                        <th>Họ tên</th>
                        <th>Ngày sinh</th>
                        <th>Trường</th>
                        <th>Phòng</th>
                        <th>Văn</th>
                        <th>Toán</th>
                        <th>Anh</th>
                        <th>Chuyên</th>
                        <th>Tổng</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(s => `
                        <tr>
                            <td>${s.stt}</td>
                            <td>${getSubjectName(s.subject)} (${s.subject})</td>
                            <td>${s.sbd}</td>
                            <td>${s.name}</td>
                            <td>${s.birthday}</td>
                            <td>${s.school}</td>
                            <td>${s.room}</td>
                            <td>${s.van !== null && s.van !== undefined ? s.van : '—'}</td>
                            <td>${s.toan !== null && s.toan !== undefined ? s.toan : '—'}</td>
                            <td>${s.anh !== null && s.anh !== undefined ? s.anh : '—'}</td>
                            <td>${s.chuyen !== null && s.chuyen !== undefined ? s.chuyen : '—'}</td>
                            <td>${s.tong !== null && s.tong !== undefined ? s.tong : '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ── Student Admission Ranking Page Initializer ──
let rankingFilterFn = null;

function initRankingPage() {
    destroyAllCharts();
    const students = getStudents();
    const subjects = getSubjects();

    const selectEl = document.getElementById('rank-subject-select');
    if (!selectEl) return;

    // Populate select
    selectEl.innerHTML = subjects.map(s => `<option value="${s}">${getSubjectName(s)} (${s})</option>`).join('');

    let dt = null;
    let selectedStatusFilter = 'all';

    const updateRanking = () => {
        const subjectCode = selectEl.value;
        const quota = getSubjectQuota(subjectCode);

        // Filter and sort students
        const subjectStudents = students.filter(s => s.subject === subjectCode);
        subjectStudents.sort((a, b) => {
            const tongA = a.tong || 0;
            const tongB = b.tong || 0;
            if (tongB !== tongA) return tongB - tongA;
            const chuyenA = a.chuyen || 0;
            const chuyenB = b.chuyen || 0;
            if (chuyenB !== chuyenA) return chuyenB - chuyenA;
            return a.sbd.localeCompare(b.sbd);
        });

        // Check disqualified:
        // - Môn thường (Văn, Toán, Anh): liệt khi điểm <= 1.0
        // - Môn chuyên: liệt khi điểm <= 2.0
        const checkDisqualified = (s) => {
            return (
                s.van === null || s.van === undefined || s.van <= 1.0 ||
                s.toan === null || s.toan === undefined || s.toan <= 1.0 ||
                s.anh === null || s.anh === undefined || s.anh <= 1.0 ||
                s.chuyen === null || s.chuyen === undefined || s.chuyen <= 2.0
            );
        };

        const roundScore = (n) => Math.round((n ?? 0) * 100) / 100;

        const qualifiedList = subjectStudents.filter(s => !checkDisqualified(s));

        let cutoffScore = null;
        if (qualifiedList.length > 0) {
            const cutoffIndex = Math.min(quota, qualifiedList.length) - 1;
            cutoffScore = roundScore(qualifiedList[cutoffIndex].tong);
        }

        let qualifiedRank = 1;
        let passedCount = 0;
        let disqualifiedCount = 0;

        const processed = subjectStudents.map(s => {
            const isLiq = checkDisqualified(s);
            let status = 'Hỏng';
            let rankText = '—';

            if (isLiq) {
                status = 'Điểm liệt';
                disqualifiedCount++;
            } else {
                rankText = qualifiedRank++;
                const tong = roundScore(s.tong);
                if (cutoffScore !== null && tong >= cutoffScore) {
                    status = 'Đậu';
                    passedCount++;
                }
            }

            return {
                ...s,
                rank: rankText,
                status: status
            };
        });

        const activeList = processed;

        const quotaEl = document.getElementById('rank-stat-quota');
        const passedEl = document.getElementById('rank-stat-passed');
        const passedSubEl = document.getElementById('rank-stat-passed-sub');
        const disqualifiedEl = document.getElementById('rank-stat-disqualified');
        const cutoffEl = document.getElementById('rank-stat-cutoff');
        const cutoffSubEl = document.getElementById('rank-stat-cutoff-sub');

        if (quotaEl) quotaEl.textContent = quota.toLocaleString('vi-VN');
        if (passedEl) passedEl.textContent = `${passedCount} / ${quota}`;
        if (passedSubEl) {
            passedSubEl.textContent = passedCount > quota
                ? `Hạng 1 đến hạng ${passedCount} (vượt chỉ tiêu do đồng điểm xét tuyển)`
                : `Hạng 1 đến hạng ${passedCount}`;
        }
        if (disqualifiedEl) disqualifiedEl.textContent = disqualifiedCount.toLocaleString('vi-VN');
        if (cutoffEl) cutoffEl.textContent = cutoffScore !== null ? cutoffScore.toFixed(2) : '—';
        if (cutoffSubEl) cutoffSubEl.textContent = cutoffScore !== null ? `Điểm xét tuyển người thứ ${Math.min(quota, qualifiedList.length)} đậu` : 'Chưa có điểm chuẩn';

        if (rankingFilterFn) {
            const oldIdx = $.fn.dataTable.ext.search.indexOf(rankingFilterFn);
            if (oldIdx !== -1) $.fn.dataTable.ext.search.splice(oldIdx, 1);
        }

        rankingFilterFn = (settings, data, dataIndex) => {
            if (settings.nTable.id !== 'ranking-table') return true;
            const item = activeList[dataIndex];
            if (!item) return false;

            if (selectedStatusFilter === 'dau' && item.status !== 'Đậu') return false;
            if (selectedStatusFilter === 'rot' && item.status !== 'Hỏng') return false;
            if (selectedStatusFilter === 'liet' && item.status !== 'Điểm liệt') return false;

            return true;
        };

        $.fn.dataTable.ext.search.push(rankingFilterFn);

        const tableEl = $('#ranking-table');
        if (dt) {
            dt.destroy();
        }

        dt = tableEl.DataTable({
            data: activeList,
            columns: [
                {
                    data: 'rank',
                    render: (data) => data !== '—' ? `<strong>${data}</strong>` : '<span class="text-muted">—</span>'
                },
                { data: 'sbd' },
                { data: 'name' },
                { data: 'birthday' },
                { data: 'school' },
                { data: 'room' },
                {
                    data: 'van',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'toan',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'anh',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'chuyen',
                    render: (data) => data !== null && data !== undefined ? data : '—'
                },
                {
                    data: 'tong',
                    render: (data) => data !== null && data !== undefined ? `<strong>${data}</strong>` : '—'
                },
                {
                    data: 'status',
                    render: (data) => {
                        if (data === 'Đậu') return '<span class="badge badge-success">Đậu</span>';
                        if (data === 'Hỏng') return '<span class="badge badge-danger">Hỏng</span>';
                        return '<span class="badge badge-warning">Điểm liệt</span>';
                    }
                }
            ],
            lengthMenu: [
                [25, 50, 100, 250, -1],
                [25, 50, 100, 250, 'Tất cả'],
            ],
            pageLength: -1,
            language: {
                search: 'Tìm nhanh:',
                lengthMenu: 'Hiển thị _MENU_ bản ghi',
                info: 'Hiển thị từ _START_ đến _END_ trong tổng số _TOTAL_ thí sinh',
                infoFiltered: '(lọc từ _MAX_ thí sinh)',
                zeroRecords: 'Không tìm thấy thí sinh phù hợp',
                paginate: {
                    first: 'Đầu',
                    last: 'Cuối',
                    next: 'Sau',
                    previous: 'Trước',
                },
            },
            responsive: true,
            order: [], 
            dom: 'lfrtip',
            deferRender: true,
            fnRowCallback(nRow, aData) {
                $(nRow).on('click', () => {
                    openStudentDetailsModal(aData);
                });
            },
        });

        const updateCounts = () => {
            const countEl = document.getElementById('rank-table-count');
            if (countEl) {
                const total = activeList.length;
                const filtered = dt.rows({ search: 'applied' }).count();
                countEl.textContent = filtered === total
                    ? `${total} thí sinh`
                    : `${filtered} / ${total} thí sinh`;
            }
        };

        const searchInput = document.querySelector('#ranking-table_wrapper .dataTables_filter input');
        if (searchInput) {
            $(searchInput).unbind();
            searchInput.oninput = debounce((e) => {
                dt.search(e.target.value.trim()).draw();
                updateCounts();
            }, 150);
        }

        updateCounts();
    };

    selectEl.onchange = () => {
        updateRanking();
    };

    const filterButtons = document.querySelectorAll('#rank-status-filters button');
    filterButtons.forEach(btn => {
        btn.onclick = (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedStatusFilter = btn.getAttribute('data-status');
            dt.draw();
            const total = dt.rows().count();
            const filtered = dt.rows({ search: 'applied' }).count();
            const countEl = document.getElementById('rank-table-count');
            if (countEl) {
                countEl.textContent = filtered === total
                    ? `${total} thí sinh`
                    : `${filtered} / ${total} thí sinh`;
            }
        };
    });

    updateRanking();

    // Setup exporting
    const btnCSV = document.getElementById('rank-export-csv');
    const btnExcel = document.getElementById('rank-export-excel');
    const btnPrint = document.getElementById('rank-export-print');

    if (btnCSV) {
        btnCSV.onclick = () => {
            const subjectCode = selectEl.value;
            const currentData = dt.rows({ search: 'applied' }).data().toArray();
            let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
            csvContent += "Hạng,SBD,Họ tên,Ngày sinh,Trường,Phòng,Văn,Toán,Anh,Chuyên,Tổng,Kết quả\n";
            currentData.forEach(s => {
                const row = [
                    s.rank,
                    s.sbd,
                    s.name,
                    s.birthday,
                    s.school,
                    s.room,
                    s.van !== null && s.van !== undefined ? s.van : '—',
                    s.toan !== null && s.toan !== undefined ? s.toan : '—',
                    s.anh !== null && s.anh !== undefined ? s.anh : '—',
                    s.chuyen !== null && s.chuyen !== undefined ? s.chuyen : '—',
                    s.tong !== null && s.tong !== undefined ? s.tong : '—',
                    s.status
                ];
                csvContent += row.map(val => `"${val}"`).join(",") + "\n";
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `xep_hang_${subjectCode}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Xuất tệp CSV thành công!', 'success');
        };
    }

    if (btnExcel) {
        btnExcel.onclick = () => {
            const subjectCode = selectEl.value;
            const currentData = dt.rows({ search: 'applied' }).data().toArray();
            let excelContent = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="utf-8"/></head>
                <body>
                <h2>BẢNG XẾP HẠNG TUYỂN SINH MÔN CHUYÊN: ${getSubjectName(subjectCode).toUpperCase()}</h2>
                <table>
                    <tr>
                        <th>Hạng</th><th>SBD</th><th>Họ tên</th><th>Ngày sinh</th><th>Trường</th><th>Phòng</th><th>Văn</th><th>Toán</th><th>Anh</th><th>Chuyên</th><th>Tổng</th><th>Kết quả</th>
                    </tr>
            `;
            currentData.forEach(s => {
                excelContent += `
                    <tr>
                        <td>${s.rank}</td><td>${s.sbd}</td><td>${s.name}</td><td>${s.birthday}</td><td>${s.school}</td><td>${s.room}</td><td>${s.van !== null && s.van !== undefined ? s.van : '—'}</td><td>${s.toan !== null && s.toan !== undefined ? s.toan : '—'}</td><td>${s.anh !== null && s.anh !== undefined ? s.anh : '—'}</td><td>${s.chuyen !== null && s.chuyen !== undefined ? s.chuyen : '—'}</td><td>${s.tong !== null && s.tong !== undefined ? s.tong : '—'}</td><td>${s.status}</td>
                    </tr>
                `;
            });
            excelContent += `</table></body></html>`;

            const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `xep_hang_${subjectCode}.xls`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Xuất tệp Excel thành công!', 'success');
        };
    }

    if (btnPrint) {
        btnPrint.onclick = () => {
            const subjectCode = selectEl.value;
            const currentData = dt.rows({ search: 'applied' }).data().toArray();
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>In Xếp Hạng Tuyển Sinh ${getSubjectName(subjectCode)}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { text-align: center; margin-bottom: 5px; }
                        h3 { text-align: center; margin-top: 0; color: #555; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .badge-success { color: green; font-weight: bold; }
                        .badge-danger { color: red; }
                        .badge-warning { color: orange; font-style: italic; }
                    </style>
                </head>
                <body onload="window.print();window.close();">
                    <h1>DANH SÁCH XẾP HẠNG TUYỂN SINH MÔN CHUYÊN</h1>
                    <h3>Môn: ${getSubjectName(subjectCode)} (${subjectCode})</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Hạng</th>
                                <th>SBD</th>
                                <th>Họ tên</th>
                                <th>Ngày sinh</th>
                                <th>Trường</th>
                                <th>Phòng</th>
                                <th>Văn</th>
                                <th>Toán</th>
                                <th>Anh</th>
                                <th>Chuyên</th>
                                <th>Tổng</th>
                                <th>Kết quả</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentData.map(s => `
                                <tr>
                                    <td>${s.rank}</td>
                                    <td>${s.sbd}</td>
                                    <td>${s.name}</td>
                                    <td>${s.birthday}</td>
                                    <td>${s.school}</td>
                                    <td>${s.room}</td>
                                    <td>${s.van !== null && s.van !== undefined ? s.van : '—'}</td>
                                    <td>${s.toan !== null && s.toan !== undefined ? s.toan : '—'}</td>
                                    <td>${s.anh !== null && s.anh !== undefined ? s.anh : '—'}</td>
                                    <td>${s.chuyen !== null && s.chuyen !== undefined ? s.chuyen : '—'}</td>
                                    <td>${s.tong !== null && s.tong !== undefined ? s.tong : '—'}</td>
                                    <td>
                                        <span class="${s.status === 'Đậu' ? 'badge-success' : s.status === 'Hỏng' ? 'badge-danger' : 'badge-warning'}">
                                            ${s.status}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `);
            printWindow.document.close();
        };
    }
}