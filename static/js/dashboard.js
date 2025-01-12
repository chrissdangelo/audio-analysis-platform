document.addEventListener('DOMContentLoaded', function() {
    let formatChart = null;
    let contentChart = null;
    let environmentChart = null;
    let characterNetworkChart = null;

    function initializeCharts() {
        // Format distribution chart (existing)
        const formatCtx = document.getElementById('formatChart').getContext('2d');
        formatChart = new Chart(formatCtx, {
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
                        labels: {
                            color: '#fff'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Content Format Distribution',
                        color: '#fff'
                    }
                }
            }
        });

        // Enhanced content types chart
        const contentCtx = document.getElementById('contentChart').getContext('2d');
        contentChart = new Chart(contentCtx, {
            type: 'bar',
            data: {
                labels: ['Narration', 'Background Music', 'Sound Effects', 'Songs'],
                datasets: [{
                    label: 'Content Elements',
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
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Audio Elements Distribution',
                        color: '#fff'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });

        // Environment distribution chart
        const environmentCtx = document.getElementById('environmentChart').getContext('2d');
        environmentChart = new Chart(environmentCtx, {
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
                        labels: {
                            color: '#fff'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Environment Distribution',
                        color: '#fff'
                    }
                }
            }
        });

        // Initialize character network
        initializeCharacterNetwork();
    }

    function updateDashboard() {
        fetch('/api/analyses')
            .then(response => response.json())
            .then(data => {
                updateFormatDistribution(data);
                updateContentTypes(data);
                updateThemeCloud(data);
                updateEnvironmentDistribution(data);
                updateCharacterNetwork(data);
            })
            .catch(error => {
                console.error('Error updating dashboard:', error);
            });
    }

    function updateFormatDistribution(analyses) {
        const formats = {};
        analyses.forEach(analysis => {
            formats[analysis.format] = (formats[analysis.format] || 0) + 1;
        });

        formatChart.data.labels = Object.keys(formats);
        formatChart.data.datasets[0].data = Object.values(formats);
        formatChart.update();
    }

    function updateContentTypes(analyses) {
        const contentTypes = {
            narration: 0,
            backgroundMusic: 0,
            soundEffects: 0,
            songs: 0
        };

        analyses.forEach(analysis => {
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

    function updateEnvironmentDistribution(analyses) {
        const environments = {};
        analyses.forEach(analysis => {
            (analysis.environments || []).forEach(env => {
                environments[env] = (environments[env] || 0) + 1;
            });
        });

        const colors = generateColors(Object.keys(environments).length);

        environmentChart.data.labels = Object.keys(environments);
        environmentChart.data.datasets[0].data = Object.values(environments);
        environmentChart.data.datasets[0].backgroundColor = colors;
        environmentChart.update();
    }

    function initializeCharacterNetwork() {
        const width = document.getElementById('characterNetwork').offsetWidth;
        const height = 400;

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
    }

    function updateCharacterNetwork(analyses) {
        const nodes = new Set();
        const links = [];

        // Build character relationships
        analyses.forEach(analysis => {
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
            .force('center', d3.forceCenter(width / 2, height / 2));

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
    }

    function updateThemeCloud(analyses) {
        const themeFrequency = {};
        analyses.forEach(analysis => {
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
        d3.select('#themeCloud').html('');

        const width = document.getElementById('themeCloud').offsetWidth;
        const height = 200;

        const fontSize = d3.scaleLinear()
            .domain([0, d3.max(themeData, d => d.value)])
            .range([14, 32]);

        // Create theme cloud with correlations
        const cloudContainer = d3.select('#themeCloud');

        themeData.forEach((d, i) => {
            const theme = cloudContainer.append('span')
                .style('font-size', `${fontSize(d.value)}px`)
                .style('margin', '5px')
                .style('display', 'inline-block')
                .style('cursor', 'pointer')
                .style('color', `hsl(${(i * 360) / themeData.length}, 70%, 60%)`)
                .text(d.text);

            // Add tooltip with correlation data
            theme.on('mouseover', function() {
                const correlations = findThemeCorrelations(d.text, analyses);
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0, 0, 0, 0.8)')
                    .style('padding', '5px')
                    .style('border-radius', '3px')
                    .style('color', '#fff')
                    .style('font-size', '12px')
                    .html(formatCorrelations(correlations));

                const [x, y] = d3.pointer(event);
                tooltip.style('left', (x + 10) + 'px')
                    .style('top', (y + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.selectAll('.tooltip').remove();
            });
        });
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

    function generateColors(count) {
        return Array.from({length: count}, (_, i) => 
            `hsl(${(i * 360) / count}, 70%, 60%)`
        );
    }

    // Initialize charts
    initializeCharts();

    // Update dashboard when new analysis is added
    document.addEventListener('analysisAdded', updateDashboard);

    // Initial dashboard update
    updateDashboard();
});