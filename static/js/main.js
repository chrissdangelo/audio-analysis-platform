document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = uploadBtn?.querySelector('.spinner-border');
    const audioFileInput = document.getElementById('audioFile');
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade';
    errorAlert.setAttribute('role', 'alert');

    // Initialize DataTable with resizable columns
    let table;

    function initializeDataTable() {
        if ($.fn.DataTable.isDataTable('#analysisTable')) {
            table = $('#analysisTable').DataTable();
        } else {
            table = $('#analysisTable').DataTable({
                scrollX: true,
                autoWidth: false,
                columnDefs: [
                    { width: '300px', targets: 1 }, // Title column wider
                    { width: '200px', targets: 2 }, // Filename column
                    { width: '100px', targets: '_all' } // Default width for other columns
                ]
            });

            // Add resizer handles to each header cell
            $('#analysisTable thead th').each(function() {
                const resizer = document.createElement('div');
                resizer.classList.add('resizer');
                this.appendChild(resizer);
                createResizableColumn(this, resizer);
            });
        }
        return table;
    }

    function createResizableColumn(th, resizer) {
        let startX, startWidth;

        function startDragging(e) {
            startX = e.pageX;
            startWidth = th.offsetWidth;
            resizer.classList.add('resizing');

            // Add event listeners for dragging
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDragging);

            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
        }

        function onDrag(e) {
            if (!startX) return;

            const diffX = e.pageX - startX;
            const newWidth = Math.max(100, startWidth + diffX); // Minimum width of 100px

            // Update column width
            th.style.width = `${newWidth}px`;
            th.style.minWidth = `${newWidth}px`;

            // Force DataTables to recalculate column widths
            if (table) {
                table.columns.adjust();
            }
        }

        function stopDragging() {
            resizer.classList.remove('resizing');
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDragging);
            document.body.style.userSelect = '';
            startX = null;
        }

        // Add mousedown event listener to resizer
        resizer.addEventListener('mousedown', startDragging);
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

    function updateTable() {
        // Only fetch and update if we're on a page with the analysis table
        const analysisTable = document.querySelector('#analysisTable');
        if (!analysisTable) return;

        if (!table) {
            table = initializeDataTable();
        }

        fetch('/api/analyses')
            .then(response => response.json())
            .then(data => {
                table.clear().rows.add(data).draw();
            })
            .catch(error => console.error('Error updating table:', error));
    }

    // Handle file upload
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();

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
                spinner.classList.add('d-inline-block');
                spinner.classList.remove('d-none');
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Upload failed');
                }

                // Refresh the table
                updateTable();

                // Clear the file input
                audioFileInput.value = '';

            } catch (error) {
                showError(error.message);
            } finally {
                // Hide spinner
                if (spinner) {
                    spinner.classList.remove('d-inline-block');
                    spinner.classList.add('d-none');
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