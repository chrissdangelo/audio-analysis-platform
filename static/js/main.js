document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = uploadBtn.querySelector('.spinner-border');
    const audioFileInput = document.getElementById('audioFile');
    const waveformContainer = document.getElementById('waveformContainer');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalDurationDisplay = document.getElementById('totalDuration');
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade';
    errorAlert.setAttribute('role', 'alert');

    let wavesurfer = null;

    // Initialize wavesurfer when an audio file is selected
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Show waveform container
        waveformContainer.style.display = 'block';

        // Destroy previous instance if it exists
        if (wavesurfer) {
            wavesurfer.destroy();
        }

        // Create new WaveSurfer instance
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#4a9eff',
            progressColor: '#1e88e5',
            cursorColor: '#fff',
            barWidth: 2,
            barRadius: 3,
            cursorWidth: 1,
            height: 100,
            barGap: 2
        });

        // Load the audio file
        wavesurfer.loadBlob(file);

        // Update time displays
        wavesurfer.on('ready', function() {
            const duration = wavesurfer.getDuration();
            totalDurationDisplay.textContent = formatTime(duration);
        });

        wavesurfer.on('audioprocess', function() {
            const currentTime = wavesurfer.getCurrentTime();
            currentTimeDisplay.textContent = formatTime(currentTime);
        });
    });

    // Play/Pause controls
    playBtn.addEventListener('click', function() {
        if (wavesurfer) {
            wavesurfer.play();
        }
    });

    pauseBtn.addEventListener('click', function() {
        if (wavesurfer) {
            wavesurfer.pause();
        }
    });

    // Format time in seconds to MM:SS
    function formatTime(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function showError(message) {
        // Remove any existing error alerts
        const existingAlert = document.querySelector('.alert-danger');
        if (existingAlert) {
            existingAlert.remove();
        }

        errorAlert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        errorAlert.classList.add('show');
        uploadForm.insertBefore(errorAlert, uploadForm.firstChild);
    }

    // Handle file upload
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const file = audioFileInput.files[0];

        if (!file) {
            showError('Please select a file');
            return;
        }

        // Check file size before uploading
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            showError('File is too large. Maximum size is 100MB');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            uploadBtn.disabled = true;
            spinner.classList.remove('d-none');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // Successfully processed
            addAnalysisToTable(data);
            uploadForm.reset();
            loadBundleSuggestions();

            // Reset waveform display
            if (wavesurfer) {
                wavesurfer.destroy();
                wavesurfer = null;
            }
            waveformContainer.style.display = 'none';

            // Remove any error messages
            const existingAlert = document.querySelector('.alert-danger');
            if (existingAlert) {
                existingAlert.remove();
            }

        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        } finally {
            uploadBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    });

    // Handle deletion
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this analysis?')) {
                try {
                    const response = await fetch(`/api/analysis/${id}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error('Delete failed');
                    }

                    const row = document.querySelector(`tr[data-id="${id}"]`);
                    row.remove();
                    loadBundleSuggestions();

                } catch (error) {
                    console.error('Error:', error);
                    showError('Error deleting analysis');
                }
            }
        }
    });

    // Load bundle suggestions
    async function loadBundleSuggestions() {
        const bundleContainer = document.getElementById('bundleSuggestions');

        try {
            const response = await fetch('/api/bundles');
            const bundles = await response.json();

            let html = '';
            if (bundles.length === 0) {
                html = '<p>No bundle suggestions available</p>';
            } else {
                html = '<ul class="list-group">';
                bundles.forEach(bundle => {
                    html += `
                        <li class="list-group-item">
                            <h6>${bundle.type}: ${bundle.name}</h6>
                            <small>${bundle.items.length} items</small>
                        </li>
                    `;
                });
                html += '</ul>';
            }

            bundleContainer.innerHTML = html;

        } catch (error) {
            console.error('Error:', error);
            bundleContainer.innerHTML = '<p class="text-danger">Error loading suggestions</p>';
        }
    }

    function addAnalysisToTable(analysis) {
        const tbody = document.getElementById('analysisTable');
        const row = document.createElement('tr');
        row.dataset.id = analysis.id;

        row.innerHTML = `
            <td>${analysis.id}</td>
            <td>${analysis.title || "Untitled"}</td>
            <td>${analysis.filename}</td>
            <td>${analysis.file_type}</td>
            <td>${analysis.format}</td>
            <td>${analysis.duration}</td>
            <td>${Array.isArray(analysis.environments) && analysis.environments.length ? analysis.environments.join(', ') : '-'}</td>
            <td>${Array.isArray(analysis.characters_mentioned) && analysis.characters_mentioned.length ? analysis.characters_mentioned.join(', ') : '-'}</td>
            <td>${Array.isArray(analysis.speaking_characters) && analysis.speaking_characters.length ? analysis.speaking_characters.join(', ') : '-'}</td>
            <td>${analysis.has_underscore ? 'Yes' : 'No'}</td>
            <td>${analysis.has_sound_effects ? 'Yes' : 'No'}</td>
            <td>${analysis.songs_count}</td>
            <td>${Array.isArray(analysis.themes) && analysis.themes.length ? analysis.themes.join(', ') : '-'}</td>
            <td>
                <a href="${analysis.debug_url}" class="btn btn-sm btn-info mb-1" target="_blank">
                    Debug
                </a>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${analysis.id}">
                    Delete
                </button>
            </td>
        `;

        tbody.prepend(row);

        // Emit event for dashboard update
        document.dispatchEvent(new CustomEvent('analysisAdded'));
    }

    // Initialize Feather icons
    feather.replace();

    // Initial load of bundle suggestions
    loadBundleSuggestions();
});