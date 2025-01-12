document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = uploadBtn.querySelector('.spinner-border');
    const audioFileInput = document.getElementById('audioFile');
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade';
    errorAlert.setAttribute('role', 'alert');

    // Initialize DataTable with dark theme configuration
    const analysisTable = $('#analysisTable').DataTable({
        order: [[0, 'desc']], // Sort by ID descending by default
        pageLength: 10,
        responsive: true,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Search records..."
        },
        columnDefs: [
            { targets: -1, orderable: false }, // Disable sorting on actions column
            { 
                targets: [9, 10], // Yes/No columns (underscore, sfx)
                render: function(data) {
                    return data === 'Yes' ? 
                        '<span class="badge bg-success">Yes</span>' : 
                        '<span class="badge bg-secondary">No</span>';
                }
            }
        ]
    });

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

            // Add new row to DataTable
            addAnalysisToTable(data);
            uploadForm.reset();

            // Dispatch event for dashboard update
            document.dispatchEvent(new CustomEvent('analysisAdded'));

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

    // Handle deletion with DataTables
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

                    // Remove row from DataTable
                    const row = analysisTable.row($(e.target).closest('tr'));
                    row.remove().draw();

                    // Trigger dashboard update
                    document.dispatchEvent(new CustomEvent('analysisAdded'));

                } catch (error) {
                    console.error('Error:', error);
                    showError('Error deleting analysis');
                }
            }
        }
    });

    function addAnalysisToTable(analysis) {
        // Create array of data for the new row
        const rowData = [
            analysis.id,
            analysis.title || "Untitled",
            analysis.filename,
            analysis.file_type,
            analysis.format,
            analysis.duration,
            Array.isArray(analysis.environments) && analysis.environments.length ? analysis.environments.join(', ') : '-',
            Array.isArray(analysis.characters_mentioned) && analysis.characters_mentioned.length ? analysis.characters_mentioned.join(', ') : '-',
            Array.isArray(analysis.speaking_characters) && analysis.speaking_characters.length ? analysis.speaking_characters.join(', ') : '-',
            analysis.has_underscore ? 'Yes' : 'No',
            analysis.has_sound_effects ? 'Yes' : 'No',
            analysis.songs_count,
            Array.isArray(analysis.themes) && analysis.themes.length ? analysis.themes.join(', ') : '-',
            `<a href="${analysis.debug_url}" class="btn btn-sm btn-info mb-1" target="_blank">Debug</a>
             <button class="btn btn-sm btn-danger delete-btn" data-id="${analysis.id}">Delete</button>`
        ];

        // Add new row to DataTable and redraw
        analysisTable.row.add(rowData).draw();
    }

    // Format time in seconds to MM:SS
    function formatTime(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

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

    // Initialize Feather icons
    feather.replace();
    loadBundleSuggestions();
});