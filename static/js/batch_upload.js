document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('audioFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressBar = document.querySelector('#uploadProgress .progress-bar');
    const progressDiv = document.getElementById('uploadProgress');
    const batchStatus = document.getElementById('batchStatus');

    async function uploadFiles(files) {
        const totalFiles = files.length;

        progressDiv.classList.remove('d-none');
        batchStatus.innerHTML = `Processing 0/${totalFiles} files...`;

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

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Batch upload failed');
            }

            const result = await response.json();
            const batchId = result.batch_id;
            const statusUrl = result.status_url;

            // Start polling for status
            await pollBatchStatus(batchId, statusUrl);

        } catch (error) {
            batchStatus.innerHTML = `<div class="alert alert-danger">Error starting batch upload: ${error.message}</div>`;
            progressDiv.classList.add('d-none');
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
                batchStatus.innerHTML += `<div class="alert alert-warning">Error checking status: ${error.message}</div>`;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    function updateBatchProgress(status) {
        const totalFiles = status.total_files;
        const processedFiles = status.processed_files + status.failed_files;
        const progress = (processedFiles / totalFiles) * 100;

        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);

        // Update status display
        let statusHtml = `<div class="mb-3">Processing ${processedFiles}/${totalFiles} files...</div>`;

        // Show current file status
        if (status.files) {
            Object.entries(status.files).forEach(([filename, fileStatus]) => {
                const statusClass = {
                    'pending': 'text-muted',
                    'processing': 'text-primary',
                    'completed': 'text-success',
                    'failed': 'text-danger'
                }[fileStatus.status] || 'text-muted';

                statusHtml += `
                    <div class="small ${statusClass}">
                        ${filename}: ${fileStatus.status}
                        ${fileStatus.error ? `(Error: ${fileStatus.error})` : ''}
                    </div>
                `;
            });
        }

        batchStatus.innerHTML = statusHtml;
    }

    function showCompletionStatus(status) {
        const totalFiles = status.total_files;
        const successFiles = status.processed_files;
        const failedFiles = status.failed_files;

        let message = `
            <div class="alert ${failedFiles > 0 ? 'alert-warning' : 'alert-success'}">
                Batch processing completed!<br>
                Successfully processed: ${successFiles}/${totalFiles} files<br>
                Failed: ${failedFiles}/${totalFiles} files
            </div>
        `;

        if (failedFiles > 0) {
            message += `
                <button class="btn btn-warning" onclick="retryBatch('${status.batch_id}')">
                    Retry Failed Files
                </button>
            `;
        }

        batchStatus.innerHTML = message;
        setTimeout(() => {
            progressDiv.classList.add('d-none');
            progressBar.style.width = '0%';
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

            // Reset progress display
            progressDiv.classList.remove('d-none');
            progressBar.style.width = '0%';
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