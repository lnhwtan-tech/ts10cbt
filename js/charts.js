/**
 * Charts Module
 * Wrapper for Chart.js to build responsive, beautiful, theme-aware charts.
 */

// Colors matching the Vercel/Linear themes defined in variables.css
const THEME_COLORS = {
    dark: {
        text: '#fafafa',
        muted: '#a1a1a1',
        grid: '#262626',
        tooltipBg: '#1e1e1e',
        tooltipBorder: '#333333',
        palette: [
            '#3b82f6', // blue
            '#8b5cf6', // purple
            '#06b6d4', // cyan
            '#22c55e', // green
            '#f59e0b', // amber
            '#ef4444', // red
            '#ec4899', // pink
            '#14b8a6', // teal
            '#f97316'  // orange
        ]
    },
    light: {
        text: '#0a0a0a',
        muted: '#525252',
        grid: '#e5e5e5',
        tooltipBg: '#ffffff',
        tooltipBorder: '#d4d4d4',
        palette: [
            '#2563eb', // blue
            '#7c3aed', // purple
            '#0891b2', // cyan
            '#16a34a', // green
            '#d97706', // amber
            '#dc2626', // red
            '#db2777', // pink
            '#0d9488', // teal
            '#ea580c'  // orange
        ]
    }
};

let activeCharts = new Map();

/**
 * Get color settings based on current theme
 */
export function getChartThemeSettings() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return THEME_COLORS[theme];
}

/**
 * Register a chart helper to recreate or destroy on reload
 */
function registerChart(id, chart) {
    if (activeCharts.has(id)) {
        activeCharts.get(id).destroy();
    }
    activeCharts.set(id, chart);
}

/**
 * Destroy all registered charts
 */
export function destroyAllCharts() {
    activeCharts.forEach(chart => chart.destroy());
    activeCharts.clear();
}

/**
 * Listen for theme switch to redraw with appropriate colors
 */
window.addEventListener('themechanged', () => {
    const settings = getChartThemeSettings();
    activeCharts.forEach(chart => {
        // Update grid lines
        if (chart.options.scales) {
            if (chart.options.scales.x && chart.options.scales.x.grid) {
                chart.options.scales.x.grid.color = settings.grid;
                chart.options.scales.x.ticks.color = settings.muted;
            }
            if (chart.options.scales.y && chart.options.scales.y.grid) {
                chart.options.scales.y.grid.color = settings.grid;
                chart.options.scales.y.ticks.color = settings.muted;
            }
        }

        // Update legend/title text colors if present
        if (chart.options.plugins) {
            if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                chart.options.plugins.legend.labels.color = settings.text;
            }
            if (chart.options.plugins.title) {
                chart.options.plugins.title.color = settings.text;
            }
            if (chart.options.plugins.tooltip) {
                chart.options.plugins.tooltip.backgroundColor = settings.tooltipBg;
                chart.options.plugins.tooltip.borderColor = settings.tooltipBorder;
                chart.options.plugins.tooltip.titleColor = settings.text;
                chart.options.plugins.tooltip.bodyColor = settings.text;
            }
        }

        // Apply updated palette for multi-color datasets (doughnut/pie)
        if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
            chart.data.datasets.forEach(dataset => {
                dataset.backgroundColor = settings.palette.slice(0, dataset.data.length);
                dataset.borderColor = settings.tooltipBorder;
            });
        } else {
            chart.data.datasets.forEach(dataset => {
                dataset.borderColor = settings.palette[0];
                dataset.backgroundColor = settings.palette[0] + '33'; // 20% opacity
            });
        }

        chart.update();
    });
});

/**
 * General options config helper for clean DRY code
 */
function getCommonOptions(settings, isHorizontal = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        plugins: {
            legend: {
                display: false,
                labels: { color: settings.text, font: { family: 'Inter', size: 11 } }
            },
            tooltip: {
                enabled: true,
                backgroundColor: settings.tooltipBg,
                borderColor: settings.tooltipBorder,
                borderWidth: 1,
                padding: 10,
                titleColor: settings.text,
                titleFont: { family: 'Inter', weight: 'bold', size: 12 },
                bodyColor: settings.text,
                bodyFont: { family: 'Inter', size: 12 },
                displayColors: false,
                cornerRadius: 6
            }
        },
        scales: {
            x: {
                grid: { color: settings.grid, drawBorder: false },
                ticks: { color: settings.muted, font: { family: 'Inter', size: 10 } }
            },
            y: {
                grid: { color: settings.grid, drawBorder: false },
                ticks: { color: settings.muted, font: { family: 'Inter', size: 10 } }
            }
        }
    };
}

/**
 * Render Bar Chart
 */
export function renderBarChart(canvasId, labels, data, datasetLabel) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const settings = getChartThemeSettings();
    const commonOpts = getCommonOptions(settings);

    const chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: datasetLabel,
                data: data,
                backgroundColor: settings.palette[0] + '40', // 25% opacity
                borderColor: settings.palette[0],
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            ...commonOpts,
            plugins: {
                ...commonOpts.plugins,
                legend: { display: false }
            }
        }
    });

    registerChart(canvasId, chartInstance);
}

/**
 * Render Horizontal Bar Chart
 */
export function renderHorizontalBarChart(canvasId, labels, data, datasetLabel) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const settings = getChartThemeSettings();
    const commonOpts = getCommonOptions(settings, true);

    const chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: datasetLabel,
                data: data,
                backgroundColor: settings.palette[1] + '40',
                borderColor: settings.palette[1],
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            ...commonOpts,
            indexAxis: 'y',
            plugins: {
                ...commonOpts.plugins,
                legend: { display: false }
            }
        }
    });

    registerChart(canvasId, chartInstance);
}

/**
 * Render Pie / Doughnut Chart
 */
export function renderPieChart(canvasId, labels, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const settings = getChartThemeSettings();

    const chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: settings.palette.slice(0, data.length),
                borderColor: settings.tooltipBorder,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: 2,
            cutout: '65%',
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        color: settings.text,
                        font: { family: 'Inter', size: 11 },
                        padding: 15,
                        boxWidth: 12,
                        boxHeight: 12,
                        borderRadius: 3
                    }
                },
                tooltip: {
                    backgroundColor: settings.tooltipBg,
                    borderColor: settings.tooltipBorder,
                    borderWidth: 1,
                    padding: 10,
                    titleColor: settings.text,
                    bodyColor: settings.text,
                    cornerRadius: 6
                }
            }
        }
    });

    registerChart(canvasId, chartInstance);
}

/**
 * Set up PNG downloading for a chart
 */
export function setupChartDownload(canvasId, downloadBtnId, filename = 'chart.png') {
    const btn = document.getElementById(downloadBtnId);
    const canvas = document.getElementById(canvasId);
    if (!btn || !canvas) return;

    btn.addEventListener('click', () => {
        const imageURI = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = filename;
        link.href = imageURI;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
