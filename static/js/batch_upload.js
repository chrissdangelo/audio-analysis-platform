document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('audioFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const batchStatus = document.getElementById('batchStatus');
    const progressModal = new bootstrap.Modal(document.getElementById('uploadProgressModal'));

    async function uploadFiles(files) {
        const totalFiles = files.length;
        if (totalFiles === 0) {
            batchStatus.innerHTML = '<div class="alert alert-warning">Please select at least one file.</div>';
            return;
        }

        // Show progress modal
        progressModal.show();
        batchStatus.innerHTML = `Preparing to upload ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`;

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
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            const batchId = result.batch_id;
            const statusUrl = result.status_url;

            // Start polling for status
            await pollBatchStatus(batchId, statusUrl);

        } catch (error) {
            batchStatus.innerHTML = `<div class="alert alert-danger">Error starting batch upload: ${error.message}</div>`;
            await new Promise(resolve => setTimeout(resolve, 3000));
            progressModal.hide();
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
                updateBatchProgress(status);

                // Check if batch is complete
                const isComplete = status.completed_at != null;
                const totalFiles = status.total_files;
                const processedFiles = status.processed_files + status.failed_files;

                if (isComplete || processedFiles === totalFiles) {
                    // Show completion message with retry option for failed files
                    showCompletionStatus(status);
                    break;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                batchStatus.innerHTML = `<div class="alert alert-danger">Error checking status: ${error.message}</div>`;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    function updateBatchProgress(status) {
        const totalFiles = status.total_files;
        const processedFiles = status.processed_files + status.failed_files;

        // Update status display
        let statusHtml = `<div class="mb-3">
            Processing ${processedFiles}/${totalFiles} files
        </div>`;

        // Show current file status
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
        setTimeout(() => {
            progressModal.hide();
            if (failedFiles === 0) {
                window.location.reload();
            }
        }, 2000);
    }

    window.retryBatch = async function(batchId) {
        try {
            const response = await fetch(`/api/upload/batch/${batchId}/retry`);
            if (!response.ok) {
                throw new Error('Failed to retry batch');
            }
            const result = await response.json();

            // Reset status display
            batchStatus.innerHTML = 'Retrying failed files...';

            // Start polling for status again
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