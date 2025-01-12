document.addEventListener('DOMContentLoaded', function() {
    let formatChart = null;
    let contentChart = null;
    let environmentChart = null;
    let characterNetworkChart = null;
    let emotionChart = null;
    let confidenceChart = null;
    let dataTable = null;
    let width = 0;

    function createDataTable() {
        if ($.fn.DataTable.isDataTable('#analysisTable')) {
            $('#analysisTable').DataTable().destroy();
        }

        dataTable = $('#analysisTable').DataTable({
            scrollX: true,
            autoWidth: false,
            colReorder: true,
            pageLength: 10,
            lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]],
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                 '<"row"<"col-sm-12"tr>>' +
                 '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
            language: {
                search: "Filter records:",
                lengthMenu: "Show _MENU_ entries per page",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                infoEmpty: "No entries found",
                infoFiltered: "(filtered from _MAX_ total entries)"
            },
            columnDefs: [
                {
                    targets: '_all',
                    render: function(data, type, row) {
                        if (type === 'display' && data != null) {
                            return '<div class="text-truncate" style="max-width: 150px;" title="' + data + '">' + data + '</div>';
                        }
                        return data;
                    }
                }
            ],
            initComplete: function() {
                // Add column resizing functionality
                new $.fn.dataTable.ColResize(dataTable, {
                    isEnabled: true,
                    hoverClass: 'dt-colresizable-hover',
                    hasBoundCheck: true,
                    minBoundClass: 'dt-colresizable-bound-min',
                    maxBoundClass: 'dt-colresizable-bound-max',
                    saveState: true,
                    isResizable: function(column) {
                        return true;
                    }
                });
            }
        });

        // Add double-click to fit content
        $('#analysisTable thead th').dblclick(function() {
            var idx = $(this).index();
            dataTable.column(idx).nodes().each(function(node, index, dt) {
                dataTable.column(idx).nodes().to$().css('width', 'auto');
            });
            dataTable.columns.adjust().draw();
        });
    }

    function initializeCharts() {
        try {
            width = document.getElementById('characterNetwork')?.offsetWidth || 800;

            // Format Chart
            const formatCtx = document.getElementById('formatChart');
            if (formatCtx?.getContext('2d')) {
                formatChart = new Chart(formatCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: [],
                        datasets: [{
                            data: [],
                            backgroundColor: [
                                'rgba(74, 158, 255, 0.8)',
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(255, 205, 86, 0.8)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: '#fff' }
                            }
                        }
                    }
                });
            }

            // Content Chart
            const contentCtx = document.getElementById('contentChart');
            if (contentCtx?.getContext('2d')) {
                contentChart = new Chart(contentCtx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['Narration', 'Background Music', 'Sound Effects', 'Songs'],
                        datasets: [{
                            data: [0, 0, 0, 0],
                            backgroundColor: [
                                'rgba(74, 158, 255, 0.8)',
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(255, 205, 86, 0.8)',
                                'rgba(153, 102, 255, 0.8)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#fff' }
                            }
                        }
                    }
                });
            }

            // Environment Chart
            const environmentCtx = document.getElementById('environmentChart');
            if (environmentCtx?.getContext('2d')) {
                environmentChart = new Chart(environmentCtx.getContext('2d'), {
                    type: 'polarArea',
                    data: {
                        labels: [],
                        datasets: [{
                            data: [],
                            backgroundColor: []
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: { color: '#fff' }
                            }
                        }
                    }
                });
            }

            // Emotion Chart
            const emotionCtx = document.getElementById('emotionChart');
            if (emotionCtx?.getContext('2d')) {
                emotionChart = new Chart(emotionCtx.getContext('2d'), {
                    type: 'radar',
                    data: {
                        labels: ['Joy', 'Sadness', 'Anger', 'Fear', 'Surprise'],
                        datasets: [{
                            label: 'Emotion Scores',
                            data: [0, 0, 0, 0, 0],
                            backgroundColor: 'rgba(74, 158, 255, 0.2)',
                            borderColor: 'rgba(74, 158, 255, 1)',
                            pointBackgroundColor: 'rgba(74, 158, 255, 1)',
                            pointBorderColor: '#fff'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                pointLabels: { color: '#fff' },
                                ticks: {
                                    color: '#fff',
                                    backdropColor: 'transparent'
                                }
                            }
                        }
                    }
                });
            }

            // Confidence Chart
            const confidenceCtx = document.getElementById('confidenceChart');
            if (confidenceCtx?.getContext('2d')) {
                confidenceChart = new Chart(confidenceCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [0, 100],
                            backgroundColor: [
                                'rgba(74, 158, 255, 0.8)',
                                'rgba(255, 255, 255, 0.1)'
                            ],
                            circumference: 180,
                            rotation: 270
                        }]
                    },
                    options: {
                        responsive: true,
                        cutout: '80%',
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false }
                        }
                    }
                });
            }

            // Initialize character network
            initializeCharacterNetwork();

            return true;
        } catch (error) {
            console.error('Error initializing charts:', error);
            return false;
        }
    }

    async function updateDashboard() {
        try {
            const response = await fetch('/api/analyses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error('Expected array of analyses');
            }

            // Update table
            if (dataTable) {
                dataTable.clear();
                data.forEach(analysis => {
                    dataTable.row.add([
                        analysis.id,
                        analysis.title || "Untitled",
                        analysis.filename,
                        analysis.file_type,
                        analysis.format,
                        analysis.duration,
                        (analysis.environments || []).join(', ') || '-',
                        (analysis.characters_mentioned || []).join(', ') || '-',
                        (analysis.speaking_characters || []).join(', ') || '-',
                        analysis.has_underscore ? "Yes" : "No",
                        analysis.has_sound_effects ? "Yes" : "No",
                        analysis.songs_count,
                        (analysis.themes || []).join(', ') || '-',
                        `<a href="/debug_analysis/${analysis.id}" class="btn btn-sm btn-info mb-1">Info</a>
                         <button class="btn btn-sm btn-danger delete-btn" data-id="${analysis.id}">Delete</button>`
                    ]);
                });
                dataTable.draw();
            }

            // Update all charts
            if (data.length > 0) {
                updateCharts(data);
                updateEmotionAnalysis(data);
            }

        } catch (error) {
            console.error('Error updating dashboard:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger';
            errorDiv.textContent = `Failed to update dashboard: ${error.message}`;
            const analysisTab = document.querySelector('#analysis');
            if (analysisTab) {
                const existingErrors = analysisTab.querySelectorAll('.alert-danger');
                existingErrors.forEach(err => err.remove());
                analysisTab.prepend(errorDiv);
            }
        }
    }

    function updateCharts(data) {
        try {
            // Format distribution
            if (formatChart) {
                const formats = {};
                data.forEach(analysis => {
                    if (analysis.format) {
                        formats[analysis.format] = (formats[analysis.format] || 0) + 1;
                    }
                });
                formatChart.data.labels = Object.keys(formats);
                formatChart.data.datasets[0].data = Object.values(formats);
                formatChart.update();
            }

            // Content types
            if (contentChart) {
                const contentTypes = {
                    narration: 0,
                    backgroundMusic: 0,
                    soundEffects: 0,
                    songs: 0
                };

                data.forEach(analysis => {
                    if (analysis.has_narration) contentTypes.narration++;
                    if (analysis.has_underscore) contentTypes.backgroundMusic++;
                    if (analysis.has_sound_effects) contentTypes.soundEffects++;
                    if (analysis.songs_count > 0) contentTypes.songs++;
                });

                contentChart.data.datasets[0].data = [
                    contentTypes.narration,
                    contentTypes.backgroundMusic,
                    contentTypes.soundEffects,
                    contentTypes.songs
                ];
                contentChart.update();
            }

            // Environment distribution
            if (environmentChart) {
                const environments = {};
                data.forEach(analysis => {
                    (analysis.environments || []).forEach(env => {
                        environments[env] = (environments[env] || 0) + 1;
                    });
                });

                const colors = Array.from(
                    { length: Object.keys(environments).length },
                    (_, i) => `hsl(${(i * 360) / Object.keys(environments).length}, 70%, 60%)`
                );

                environmentChart.data.labels = Object.keys(environments);
                environmentChart.data.datasets[0].data = Object.values(environments);
                environmentChart.data.datasets[0].backgroundColor = colors;
                environmentChart.update();
            }

            // Theme cloud and character network
            updateThemeCloud(data);
            updateCharacterNetwork(data);

        } catch (error) {
            console.error('Error updating charts:', error);
            throw error;
        }
    }

    function updateEmotionAnalysis(data) {
        try {
            // Calculate average emotion scores
            const totalEmotions = {
                joy: 0,
                sadness: 0,
                anger: 0,
                fear: 0,
                surprise: 0
            };
            let totalConfidence = 0;
            const dominantEmotions = {};

            data.forEach(analysis => {
                if (analysis.emotion_scores) {
                    Object.entries(analysis.emotion_scores).forEach(([emotion, score]) => {
                        if (totalEmotions.hasOwnProperty(emotion)) {
                            totalEmotions[emotion] += score || 0;
                        }
                    });
                }

                if (analysis.confidence_score) {
                    totalConfidence += analysis.confidence_score;
                }

                if (analysis.dominant_emotion) {
                    dominantEmotions[analysis.dominant_emotion] = 
                        (dominantEmotions[analysis.dominant_emotion] || 0) + 1;
                }
            });

            // Update emotion radar chart
            if (emotionChart) {
                const avgEmotions = Object.values(totalEmotions).map(score => 
                    score / Math.max(1, data.length));
                emotionChart.data.datasets[0].data = avgEmotions;
                emotionChart.update();
            }

            // Update confidence gauge
            if (confidenceChart) {
                const avgConfidence = totalConfidence / Math.max(1, data.length);
                confidenceChart.data.datasets[0].data = [
                    avgConfidence * 100,
                    100 - (avgConfidence * 100)
                ];
                confidenceChart.update();
            }

            // Update dominant emotion display
            const dominantEmotion = Object.entries(dominantEmotions)
                .sort((a, b) => b[1] - a[1])[0];

            const dominantEl = document.getElementById('dominantEmotion');
            if (dominantEl && dominantEmotion) {
                dominantEl.textContent = dominantEmotion[0].charAt(0).toUpperCase() +
                    dominantEmotion[0].slice(1);
            }

            // Update tone analysis
            const toneDiv = document.getElementById('toneAnalysis');
            if (toneDiv && data.length > 0) {
                const lastAnalysis = data[data.length - 1];
                if (lastAnalysis?.tone_analysis) {
                    const toneAnalysis = typeof lastAnalysis.tone_analysis === 'string'
                        ? JSON.parse(lastAnalysis.tone_analysis)
                        : lastAnalysis.tone_analysis;

                    toneDiv.innerHTML = Object.entries(toneAnalysis)
                        .map(([key, value]) =>
                            `<span class="badge bg-secondary me-2">${key}: ${value}</span>`
                        ).join('');
                }
            }
        } catch (error) {
            console.error('Error updating emotion analysis:', error);
        }
    }

    function initializeCharacterNetwork() {
        try {
            const container = document.getElementById('characterNetwork');
            if (!container) return;

            const height = 400;
            width = container.offsetWidth || 800;

            const svg = d3.select('#characterNetwork')
                .append('svg')
                .attr('width', width)
                .attr('height', height);

            // Add zoom functionality
            const g = svg.append('g');
            svg.call(d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                }));
        } catch (error) {
            console.error('Error initializing character network:', error);
        }
    }

    function updateCharacterNetwork(data) {
        try {
            const nodes = new Set();
            const links = [];

            // Build character relationships
            data.forEach(analysis => {
                const speakingChars = analysis.speaking_characters || [];
                speakingChars.forEach(char => nodes.add(char));

                // Create links between characters that appear together
                for (let i = 0; i < speakingChars.length; i++) {
                    for (let j = i + 1; j < speakingChars.length; j++) {
                        links.push({
                            source: speakingChars[i],
                            target: speakingChars[j],
                            value: 1
                        });
                    }
                }
            });

            const nodesArray = Array.from(nodes);
            const simulation = d3.forceSimulation(nodesArray.map(d => ({id: d})))
                .force('link', d3.forceLink(links).id(d => d.id))
                .force('charge', d3.forceManyBody().strength(-100))
                .force('center', d3.forceCenter(width / 2, 200));

            const svg = d3.select('#characterNetwork svg g');

            // Clear previous network
            svg.selectAll('*').remove();

            // Draw links
            const link = svg.append('g')
                .selectAll('line')
                .data(links)
                .enter().append('line')
                .attr('stroke', '#999')
                .attr('stroke-opacity', 0.6);

            // Draw nodes
            const node = svg.append('g')
                .selectAll('circle')
                .data(nodesArray.map(d => ({id: d})))
                .enter().append('circle')
                .attr('r', 5)
                .attr('fill', (d, i) => d3.schemeCategory10[i % 10]);

            // Add labels
            const labels = svg.append('g')
                .selectAll('text')
                .data(nodesArray.map(d => ({id: d})))
                .enter().append('text')
                .text(d => d.id)
                .attr('font-size', '10px')
                .attr('dx', 8)
                .attr('dy', 3)
                .attr('fill', '#fff');

            // Update positions on simulation tick
            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);

                labels
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            });
        } catch (error) {
            console.error('Error updating character network:', error);
        }
    }

    function updateThemeCloud(data) {
        try {
            const themeFrequency = {};
            data.forEach(analysis => {
                (analysis.themes || []).forEach(theme => {
                    themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
                });
            });

            const themeData = Object.entries(themeFrequency)
                .map(([text, value]) => ({
                    text,
                    value
                }))
                .sort((a, b) => b.value - a.value);

            // Clear previous cloud
            const cloudContainer = d3.select('#themeCloud');
            cloudContainer.html('');

            const fontSize = d3.scaleLinear()
                .domain([0, d3.max(themeData, d => d.value)])
                .range([14, 32]);

            themeData.forEach((d, i) => {
                const theme = cloudContainer.append('span')
                    .style('font-size', `${fontSize(d.value)}px`)
                    .style('margin', '5px')
                    .style('display', 'inline-block')
                    .style('cursor', 'pointer')
                    .style('color', `hsl(${(i * 360) / themeData.length}, 70%, 60%)`)
                    .text(d.text);

                // Add tooltip with correlation data
                theme.on('mouseover', function(event) {
                    const correlations = findThemeCorrelations(d.text, data);
                    const tooltip = d3.select('body').append('div')
                        .attr('class', 'tooltip')
                        .style('position', 'absolute')
                        .style('background', 'rgba(0, 0, 0, 0.8)')
                        .style('padding', '5px')
                        .style('border-radius', '3px')
                        .style('color', '#fff')
                        .style('font-size', '12px')
                        .html(formatCorrelations(correlations));

                    tooltip.style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY + 10) + 'px');
                })
                .on('mouseout', function() {
                    d3.selectAll('.tooltip').remove();
                });
            });
        } catch (error) {
            console.error('Error updating theme cloud:', error);
        }
    }

    function findThemeCorrelations(theme, analyses) {
        const correlations = {};
        const themeAnalyses = analyses.filter(a => (a.themes || []).includes(theme));

        themeAnalyses.forEach(analysis => {
            (analysis.themes || []).forEach(t => {
                if (t !== theme) {
                    correlations[t] = (correlations[t] || 0) + 1;
                }
            });
        });

        return Object.entries(correlations)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
    }

    function formatCorrelations(correlations) {
        if (correlations.length === 0) return 'No correlations found';
        return 'Related themes:<br>' + correlations
            .map(([theme, count]) => `${theme} (${count})`)
            .join('<br>');
    }

    // Initialize components
    document.querySelector('#analysis-tab').addEventListener('shown.bs.tab', updateDashboard);

    if (initializeCharts()) {
        createDataTable();
        updateDashboard();
        setInterval(updateDashboard, 30000);
    }

    document.addEventListener('analysisAdded', updateDashboard);
});