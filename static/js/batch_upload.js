document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('audioFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const batchStatus = document.getElementById('batchStatus');

    async function updateTable(results) {
    const searchResults = document.getElementById('searchResults');
    if (!results.length) {
        searchResults.innerHTML = '<div class="alert alert-info">No matches found</div>';
        return;
    }
    // Update table with results
    let html = '<table class="table"><thead><tr><th>Title</th><th>Format</th><th>Duration</th></tr></thead><tbody>';
    results.forEach(result => {
        html += `<tr>
            <td>${result.title}</td>
            <td>${result.format}</td>
            <td>${result.duration}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    searchResults.innerHTML = html;
}

async function uploadFiles(files) {
        if (files.length === 0) {
            batchStatus.innerHTML = '<div class="alert alert-warning">Please select at least one file.</div>';
            return;
        }

        batchStatus.innerHTML = `<div class="alert alert-info">Starting upload of ${files.length} file${files.length > 1 ? 's' : ''}...</div>`;

        // Create FormData with all files
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files[]', files[i]);
        }

        try {
            // Start batch upload
            const response = await fetch('/api/upload/batch', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Batch upload failed');
            }

            if (result.duplicates && result.duplicates.length > 0) {
                batchStatus.innerHTML += `<div class="alert alert-warning">
                    Some files were skipped (duplicates): ${result.duplicates.join(', ')}
                </div>`;
            }

            // Poll for status updates
            const batchId = result.batch_id;
            await pollBatchStatus(batchId, result.status_url);

        } catch (error) {
            batchStatus.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        }
    }

    async function pollBatchStatus(batchId, statusUrl) {
        while (true) {
            try {
                const response = await fetch(statusUrl);
                if (!response.ok) {
                    throw new Error('Failed to get batch status');
                }

                const status = await response.json();
                updateBatchStatus(status);

                if (status.is_complete || status.completed_at) {
                    showCompletionStatus(status);
                    break;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                batchStatus.innerHTML = `<div class="alert alert-danger">Error checking status: ${error.message}</div>`;
                break;
            }
        }
    }

    function updateBatchStatus(status) {
        const totalFiles = status.total_files;
        const processedFiles = status.processed_files + status.failed_files;

        let statusHtml = `<div class="alert alert-info">
            Processing ${processedFiles}/${totalFiles} files
        </div>`;

        if (status.files) {
            statusHtml += '<div class="file-status-container">';
            Object.entries(status.files).forEach(([filename, fileStatus]) => {
                const statusClass = {
                    'pending': 'text-muted',
                    'processing': 'text-primary',
                    'completed': 'text-success',
                    'failed': 'text-danger'
                }[fileStatus.status] || 'text-muted';

                const operation = fileStatus.current_operation || 'waiting';

                statusHtml += `
                    <div class="file-status ${fileStatus.status} mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="filename">${filename}</span>
                            <span class="${statusClass}">
                                ${fileStatus.status.toUpperCase()}
                                ${fileStatus.error ? `<i class="fas fa-exclamation-circle" title="${fileStatus.error}"></i>` : ''}
                            </span>
                        </div>
                        ${fileStatus.status === 'processing' ? `
                            <div class="small text-muted mt-1">
                                ${operation}...
                            </div>
                        ` : ''}
                        ${fileStatus.error ? `
                            <div class="error-message small text-danger mt-1">
                                ${fileStatus.error}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            statusHtml += '</div>';
        }

        batchStatus.innerHTML = statusHtml;
    }

    function showCompletionStatus(status) {
        const totalFiles = status.total_files;
        const successFiles = status.processed_files;
        const failedFiles = status.failed_files;

        let message = `
            <div class="alert ${failedFiles > 0 ? 'alert-warning' : 'alert-success'}">
                <h5 class="alert-heading mb-2">
                    ${failedFiles > 0 ? 'Batch Processing Completed with Issues' : 'Batch Processing Complete!'}
                </h5>
                <div class="mb-2">Successfully processed: ${successFiles}/${totalFiles} files</div>
                ${failedFiles > 0 ? `<div class="mb-2">Failed: ${failedFiles}/${totalFiles} files</div>` : ''}
            </div>
        `;

        if (failedFiles > 0) {
            message += `
                <button class="btn btn-warning" onclick="retryBatch('${status.batch_id}')">
                    <i class="fas fa-sync-alt me-2"></i>Retry Failed Files
                </button>
            `;
        }

        batchStatus.innerHTML = message;
        if (failedFiles === 0) {
            setTimeout(() => window.location.reload(), 2000);
        }
    }

    window.retryBatch = async function(batchId) {
        try {
            const response = await fetch(`/api/upload/batch/${batchId}/retry`);
            if (!response.ok) {
                throw new Error('Failed to retry batch');
            }
            const result = await response.json();
            batchStatus.innerHTML = 'Retrying failed files...';
            await pollBatchStatus(batchId, result.status_url);
        } catch (error) {
            batchStatus.innerHTML = `<div class="alert alert-danger">Error retrying batch: ${error.message}</div>`;
        }
    };

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const files = fileInput.files;

        if (files.length === 0) {
            batchStatus.innerHTML = '<div class="alert alert-warning">Please select at least one file.</div>';
            return;
        }

        const spinner = uploadBtn.querySelector('.spinner-border');
        uploadBtn.disabled = true;
        spinner.classList.remove('d-none');

        try {
            await uploadFiles(files);
        } catch (error) {
            batchStatus.innerHTML = `<div class="alert alert-danger">Batch processing failed: ${error.message}</div>`;
        } finally {
            uploadBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    });
});