document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('audioFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressBar = document.querySelector('#uploadProgress .progress-bar');
    const progressDiv = document.getElementById('uploadProgress');
    const batchStatus = document.getElementById('batchStatus');

    async function uploadFiles(files) {
        const totalFiles = files.length;
        let completedFiles = 0;

        progressDiv.classList.remove('d-none');
        batchStatus.innerHTML = `Processing 0/${totalFiles} files...`;

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Upload failed');
                }

                completedFiles++;
                const progress = (completedFiles / totalFiles) * 100;
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
                batchStatus.innerHTML = `Processing ${completedFiles}/${totalFiles} files...`;

            } catch (error) {
                batchStatus.innerHTML += `<div class="alert alert-danger">Error processing ${file.name}: ${error.message}</div>`;
            }
        }

        batchStatus.innerHTML += '<div class="alert alert-success">Batch processing completed!</div>';
        setTimeout(() => {
            progressDiv.classList.add('d-none');
            progressBar.style.width = '0%';
            window.location.reload();
        }, 2000);
    }

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
