document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = uploadBtn?.querySelector('.spinner-border');
    const audioFileInput = document.getElementById('audioFile');
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade';
    errorAlert.setAttribute('role', 'alert');

    let accessToken = null;

    // Function to get guest access token
    async function getGuestAccessToken() {
        try {
            const response = await fetch('/api/guest-access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    duration_days: 1,
                    access_level: 'read-write'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get access token');
            }

            const data = await response.json();
            return data.access.access_token;
        } catch (error) {
            console.error('Error getting access token:', error);
            showError('Error accessing the application. Please try again later.');
            return null;
        }
    }

    // Initialize access token
    (async function initializeAccess() {
        accessToken = await getGuestAccessToken();
    })();

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

    async function updateTable() {
        // Only fetch and update if we're on a page with the analysis table
        const analysisTable = document.querySelector('table tbody');
        if (!analysisTable) return;

        if (!accessToken) {
            console.error('No access token available');
            return;
        }

        try {
            const response = await fetch(`/api/analyses?access_token=${accessToken}`);
            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be expired, try to get a new one
                    accessToken = await getGuestAccessToken();
                    if (accessToken) {
                        // Retry with new token
                        return updateTable();
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const tbody = document.querySelector('table tbody');
            if (!tbody) return;

            tbody.innerHTML = ''; // Clear existing rows
            data.forEach(item => {
                // Create table row
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.title}</td>
                    <td>${item.filename}</td>
                    <td>${item.format}</td>
                    <td>${item.duration}</td>
                    <td>${item.environments}</td>
                    <td>${item.characters_mentioned}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error updating table:', error);
        }
    }

    // Handle file upload
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!accessToken) {
                showError('Unable to authenticate. Please refresh the page and try again.');
                return;
            }

            const file = audioFileInput.files[0];
            if (!file) {
                showError('Please select a file');
                return;
            }

            // Check file size before uploading
            const maxSize = 500 * 1024 * 1024; // 500MB
            if (file.size > maxSize) {
                showError('File is too large. Maximum size is 500MB');
                return;
            }

            // Show spinner
            if (spinner) {
                spinner.style.display = 'inline-block';
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`/api/upload?access_token=${accessToken}`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Upload failed');
                }

                // Update the table with the new data
                updateTable();

                // Clear the file input
                audioFileInput.value = '';

            } catch (error) {
                showError(error.message);
            } finally {
                // Hide spinner
                if (spinner) {
                    spinner.style.display = 'none';
                }
            }
        });
    }

    // Initialize audio player if present
    const audioPlayer = document.getElementById('audioPlayer');
    const playBtn = document.getElementById('playBtn');
    if (playBtn && audioPlayer) {
        playBtn.addEventListener('click', function() {
            if (audioPlayer.paused) {
                audioPlayer.play();
                this.innerHTML = '<i class="bi bi-pause-fill"></i>';
            } else {
                audioPlayer.pause();
                this.innerHTML = '<i class="bi bi-play-fill"></i>';
            }
        });
    }

    // Initial table load
    updateTable();

    // Set up periodic table refresh
    setInterval(updateTable, 30000); // Refresh every 30 seconds
});