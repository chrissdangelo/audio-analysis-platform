document.addEventListener('DOMContentLoaded', function() {
    // Initialize DataTable with column management features
    const table = $('#analysisTable').DataTable({
        scrollX: true,     // Enable horizontal scrolling
        autoWidth: false,  // Disable automatic column width calculation
        dom: 'Bfrtip',     // Add buttons to the DataTable
        buttons: [
            {
                extend: 'colvis',
                text: 'Toggle Columns',
                className: 'btn btn-secondary'
            },
            {
                text: 'Reset Columns',
                className: 'btn btn-secondary',
                action: function (e, dt, node, config) {
                    // Clear stored column widths
                    localStorage.removeItem('analysisTableColumnWidths');
                    // Reset column visibility
                    table.columns().visible(true);
                    // Reset column widths to default
                    table.columns().every(function() {
                        $(this.header()).width('auto');
                    });
                    table.draw();
                }
            }
        ],
        columnDefs: [
            {
                targets: 1,  // Title column (second column)
                width: '600px',
                className: 'fixed-width'
            },
            {
                targets: 2,  // Filename column (third column)
                width: '300px',
                className: 'fixed-width'
            },
            {
                targets: -1,   // Last column (Actions)
                orderable: false,
                width: '100px'
            }
        ],
        order: [[0, 'desc']], // Sort by first column (ID) by default
        initComplete: function() {
            const headerCells = $('#analysisTable thead th').not(':last'); // Skip Actions column

            // Load saved column widths
            const savedWidths = JSON.parse(localStorage.getItem('analysisTableColumnWidths') || '{}');
            headerCells.each(function(index) {
                const width = savedWidths[index];
                if (width) {
                    $(this).width(width);
                    table.column(index).nodes().each(function(cell) {
                        $(cell).width(width);
                    });
                }
            });

            // Add resize handles to each header cell
            headerCells.each(function() {
                const resizer = document.createElement('div');
                resizer.className = 'resizer';
                this.appendChild(resizer);
            });

            // Initialize column resizing
            let currentResizer;
            let startX, startWidth;

            headerCells.on('mousedown', '.resizer', function(e) {
                currentResizer = e.target;
                const headerCell = currentResizer.parentElement;
                startX = e.pageX;
                startWidth = headerCell.offsetWidth;

                $(currentResizer).addClass('resizing');

                // Add event listeners for mousemove and mouseup
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', stopResize);

                // Prevent text selection while resizing
                e.preventDefault();
            });

            function resize(e) {
                if (currentResizer) {
                    const headerCell = currentResizer.parentElement;
                    const columnIndex = $(headerCell).index();
                    const width = startWidth + (e.pageX - startX);

                    // Update column width
                    if (width >= 50) { // Minimum width
                        $(headerCell).width(width);
                        table.column(columnIndex).nodes().each(function(cell) {
                            $(cell).width(width);
                        });

                        // Save column widths to localStorage
                        const savedWidths = JSON.parse(localStorage.getItem('analysisTableColumnWidths') || '{}');
                        savedWidths[columnIndex] = width;
                        localStorage.setItem('analysisTableColumnWidths', JSON.stringify(savedWidths));
                    }
                }
            }

            function stopResize() {
                if (currentResizer) {
                    $(currentResizer).removeClass('resizing');
                    document.removeEventListener('mousemove', resize);
                    document.removeEventListener('mouseup', stopResize);
                    currentResizer = null;

                    // Force table redraw to ensure proper layout
                    table.columns.adjust().draw();
                }
            }
        }
    });

    // Handle delete button clicks
    $('#analysisTable').on('click', '.delete-btn', async function(e) {
        e.preventDefault();
        const id = $(this).data('id');
        if (confirm('Are you sure you want to delete this analysis?')) {
            try {
                const response = await fetch(`/api/analysis/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Delete failed');
                }

                table.row($(this).closest('tr')).remove().draw();
                document.dispatchEvent(new CustomEvent('analysisDeleted'));
            } catch (error) {
                console.error('Error:', error);
                showError(`Failed to delete analysis: ${error.message}`);
            }
        }
    });

    // Handle title editing
    $('#analysisTable').on('click', '.edit-title', async function(e) {
        e.preventDefault();
        const cell = $(this).closest('td');
        const titleSpan = cell.find('.title-text');
        const currentTitle = titleSpan.text();
        const id = $(this).data('id');

        // Create input field
        const input = $('<input>')
            .attr('type', 'text')
            .val(currentTitle)
            .addClass('form-control');

        // Replace title with input
        titleSpan.hide();
        $(this).hide();
        cell.append(input);
        input.focus();

        // Add save and cancel buttons
        const saveBtn = $('<button>')
            .addClass('btn btn-sm btn-success me-1')
            .html('<i class="bi bi-check"></i>');
        const cancelBtn = $('<button>')
            .addClass('btn btn-sm btn-danger')
            .html('<i class="bi bi-x"></i>');

        const btnGroup = $('<div>')
            .addClass('btn-group ms-2')
            .append(saveBtn)
            .append(cancelBtn);
        cell.append(btnGroup);

        // Handle save
        saveBtn.on('click', async function() {
            const newTitle = input.val().trim();
            if (!newTitle) {
                showError('Title cannot be empty');
                return;
            }

            try {
                const response = await fetch(`/api/analysis/${id}/update_title`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title: newTitle }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update title');
                }

                const result = await response.json();
                titleSpan.text(result.title);
                resetTitleCell();
            } catch (error) {
                console.error('Error:', error);
                showError(`Failed to update title: ${error.message}`);
            }
        });

        // Handle cancel
        cancelBtn.on('click', function() {
            resetTitleCell();
        });

        // Handle Enter key
        input.on('keypress', function(e) {
            if (e.which === 13) {
                saveBtn.click();
            }
        });

        // Handle Escape key
        input.on('keyup', function(e) {
            if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

        function resetTitleCell() {
            input.remove();
            btnGroup.remove();
            titleSpan.show();
            cell.find('.edit-title').show();
        }
    });

    // Function to show error messages
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.textContent = message;
        const container = document.querySelector('.container');
        if (container) {
            const existingErrors = container.querySelectorAll('.alert-danger');
            existingErrors.forEach(err => err.remove());
            container.prepend(errorDiv);
        }
    }

    // Function to update table data
    async function updateTable() {
        try {
            const response = await fetch('/api/analyses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            table.clear();
            data.forEach(analysis => {
                table.row.add([
                    analysis.id,
                    `<div class="d-flex align-items-center">
                        <span class="title-text">${analysis.title || "Untitled"}</span>
                        <button class="btn btn-sm btn-link edit-title ms-2" data-id="${analysis.id}">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                    </div>`,
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
                    `<div class="btn-group" role="group">
                        <a href="/debug_analysis/${analysis.id}" class="btn btn-sm btn-info">Info</a>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${analysis.id}">Delete</button>
                    </div>`
                ]);
            });
            table.draw();
            updateCharts(data);
            updateEmotionAnalysis(data);
        } catch (error) {
            console.error('Error updating table:', error);
            showError(`Failed to update table: ${error.message}`);
        }
    }

    // Handle tab switching
    document.querySelector('#analysis-tab')?.addEventListener('shown.bs.tab', function() {
        updateTable();
    });

    // Set up event listeners
    document.addEventListener('analysisAdded', updateTable);
    document.addEventListener('analysisDeleted', updateTable);

    // Initial table update
    updateTable();

    // Periodic refresh
    setInterval(updateTable, 30000);
});

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

// Initialize charts after DataTable is ready.  This ensures the width is correctly calculated
if (initializeCharts()){
    updateTable();
}

// Handle tab switching
document.querySelector('#analysis-tab')?.addEventListener('shown.bs.tab', function() {
    updateTable();
});

// Set up event listeners
document.addEventListener('analysisAdded', updateTable);
document.addEventListener('analysisDeleted', updateTable);
setInterval(updateTable, 30000);

function generateContentSummary(data) {
    const totalItems = data.length;
    if (totalItems === 0) {
        return "No content has been analyzed yet.";
    }

    // Calculate format distribution
    const formats = {};
    data.forEach(item => {
        formats[item.format] = (formats[item.format] || 0) + 1;
    });

    // Calculate audio elements
    const audioStats = {
        withNarration: data.filter(item => item.has_narration).length,
        withMusic: data.filter(item => item.has_underscore).length,
        withSoundEffects: data.filter(item => item.has_sound_effects).length,
        totalSongs: data.reduce((sum, item) => sum + item.songs_count, 0)
    };

    // Collect all unique themes and characters
    const themes = new Set();
    const characters = new Set();
    const characterAppearances = {};
    const themeOccurrences = {};
    const emotionPatterns = [];

    data.forEach(item => {
        if (Array.isArray(item.themes)) {
            item.themes.forEach(theme => {
                themes.add(theme);
                themeOccurrences[theme] = (themeOccurrences[theme] || 0) + 1;
            });
        }
        if (Array.isArray(item.characters_mentioned)) {
            item.characters_mentioned.forEach(char => {
                characters.add(char);
                characterAppearances[char] = (characterAppearances[char] || 0) + 1;
            });
        }
        if (item.emotion_scores) {
            emotionPatterns.push(item.emotion_scores);
        }
    });

    // Calculate average confidence score
    const avgConfidence = data.reduce((sum, item) => sum + (item.confidence_score || 0), 0) / totalItems;

    // Find most common themes and characters
    const topThemes = Object.entries(themeOccurrences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([theme, count]) => `${theme} (${count} times)`);

    const topCharacters = Object.entries(characterAppearances)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([char, count]) => `${char} (${count} appearances)`);

    // Calculate dominant emotions across corpus
    const avgEmotions = emotionPatterns.reduce((acc, emotions) => {
        Object.entries(emotions).forEach(([emotion, score]) => {
            acc[emotion] = (acc[emotion] || 0) + score;
        });
        return acc;
    }, {});

    Object.keys(avgEmotions).forEach(key => {
        avgEmotions[key] /= emotionPatterns.length;
    });

    const dominantEmotion = Object.entries(avgEmotions)
        .sort((a, b) => b[1] - a[1])[0][0];

    // Generate summary text
    const basicSummary = `This corpus contains ${totalItems} analyzed pieces of content. ` +
        `The content is primarily ${Object.entries(formats).map(([k,v]) => `${v} ${k}`).join(' and ')}. ` +
        `${audioStats.withNarration} pieces contain narration, ${audioStats.withMusic} have background music, ` +
        `and ${audioStats.withSoundEffects} include sound effects. There are ${audioStats.totalSongs} total songs across all content. ` +
        `The collection features ${characters.size} unique characters and explores ${themes.size} distinct themes. ` +
        `Analysis confidence averages ${(avgConfidence * 100).toFixed(1)}%.`;

    const aiInsights = `\n\nAI Analysis Insights: The most prominent themes are ${topThemes.join(', ')}, ` +
        `while the most frequently appearing characters are ${topCharacters.join(', ')}. ` +
        `The emotional landscape is predominantly ${dominantEmotion}, suggesting a consistent tone across the corpus. ` +
        `${characters.size > 10 ? 'The large character ensemble suggests a rich, interconnected narrative universe. ' : ''}` +
        `${audioStats.withMusic / totalItems > 0.7 ? 'The high prevalence of background music indicates strong emphasis on mood and atmosphere. ' : ''}` +
        `${themes.size > 5 ? 'The diverse range of themes suggests content designed to engage with multiple aspects of the audience\'s interests.' : ''}`;

    return basicSummary + aiInsights;
}

function updateCharts(data) {
    try {
        // Update content summary
        const summaryElement = document.getElementById('content-summary');
        if (summaryElement) {
            summaryElement.textContent = generateContentSummary(data);
        }
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
            environmentChart.data.datasets[0].backgroundColor = colors.map(() => 'rgba(150, 150, 150, 0.2)');
            environmentChart.options.plugins.legend.display = false;
            environmentChart.options.onHover = (event, elements) => {
                if (elements.length) {
                    const index = elements[0].index;
                    environmentChart.data.datasets[0].backgroundColor = colors.map((color, i) => 
                        i === index ? color : 'rgba(150, 150, 150, 0.2)'
                    );
                } else {
                    environmentChart.data.datasets[0].backgroundColor = colors.map(() => 'rgba(150, 150, 150, 0.2)');
                }
                environmentChart.update();
            };
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