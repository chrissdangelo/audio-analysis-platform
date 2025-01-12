document.addEventListener('DOMContentLoaded', function() {
    let formatChart = null;
    let contentChart = null;

    function initializeCharts() {
        // Format distribution chart
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
                    }
                }
            }
        });

        // Content types chart
        const contentCtx = document.getElementById('contentChart').getContext('2d');
        contentChart = new Chart(contentCtx, {
            type: 'bar',
            data: {
                labels: ['Narration', 'Music', 'Sound Effects'],
                datasets: [{
                    data: [0, 0, 0],
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
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#fff'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }

    function updateDashboard() {
        fetch('/api/analyses')
            .then(response => response.json())
            .then(data => {
                updateFormatDistribution(data);
                updateContentTypes(data);
                updateThemeCloud(data);
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
            music: 0,
            soundEffects: 0
        };

        analyses.forEach(analysis => {
            if (analysis.has_narration) contentTypes.narration++;
            if (analysis.has_underscore) contentTypes.music++;
            if (analysis.sound_effects_count > 0) contentTypes.soundEffects++;
        });

        contentChart.data.datasets[0].data = [
            contentTypes.narration,
            contentTypes.music,
            contentTypes.soundEffects
        ];
        contentChart.update();
    }

    function updateThemeCloud(analyses) {
        const themeFrequency = {};
        analyses.forEach(analysis => {
            analysis.themes.forEach(theme => {
                themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
            });
        });

        const themeData = Object.entries(themeFrequency).map(([text, value]) => ({
            text,
            value
        }));

        // Clear previous cloud
        d3.select('#themeCloud').html('');

        // Create word cloud
        const width = document.getElementById('themeCloud').offsetWidth;
        const height = 200;

        const fontSize = d3.scaleLinear()
            .domain([0, d3.max(themeData, d => d.value)])
            .range([14, 32]);

        themeData.forEach((d, i) => {
            const theme = document.createElement('span');
            theme.textContent = d.text;
            theme.style.fontSize = `${fontSize(d.value)}px`;
            theme.style.margin = '5px';
            theme.style.display = 'inline-block';
            theme.style.color = `hsl(${(i * 360) / themeData.length}, 70%, 60%)`;
            document.getElementById('themeCloud').appendChild(theme);
        });
    }

    // Initialize charts
    initializeCharts();

    // Update dashboard when new analysis is added
    document.addEventListener('analysisAdded', updateDashboard);

    // Initial dashboard update
    updateDashboard();
});
