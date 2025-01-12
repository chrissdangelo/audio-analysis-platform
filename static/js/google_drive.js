document.addEventListener('DOMContentLoaded', function() {
    const driveBtn = document.getElementById('googleDriveBtn');
    const driveModal = new bootstrap.Modal(document.getElementById('driveFileModal'));
    const driveFileList = document.getElementById('driveFileList');
    const selectDriveFiles = document.getElementById('selectDriveFiles');
    
    let selectedDriveFiles = new Set();
    
    driveBtn.addEventListener('click', async function() {
        try {
            const response = await fetch('/drive/files');
            const data = await response.json();
            
            if (data.error) {
                if (data.error.includes('authentication')) {
                    window.location.href = '/drive/authorize';
                    return;
                }
                throw new Error(data.error);
            }
            
            // Clear previous list and selection
            driveFileList.innerHTML = '';
            selectedDriveFiles.clear();
            
            // Populate file list
            data.files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'list-group-item list-group-item-action';
                item.dataset.fileId = file.id;
                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span>${file.name}</span>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${file.id}">
                        </div>
                    </div>
                `;
                
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', function() {
                    if (this.checked) {
                        selectedDriveFiles.add(file.id);
                    } else {
                        selectedDriveFiles.delete(file.id);
                    }
                });
                
                driveFileList.appendChild(item);
            });
            
            driveModal.show();
            
        } catch (error) {
            console.error('Error loading Google Drive files:', error);
            const batchStatus = document.getElementById('batchStatus');
            batchStatus.innerHTML = `<div class="alert alert-danger">Error loading Google Drive files: ${error.message}</div>`;
        }
    });
    
    selectDriveFiles.addEventListener('click', async function() {
        if (selectedDriveFiles.size === 0) {
            alert('Please select at least one file');
            return;
        }
        
        const batchStatus = document.getElementById('batchStatus');
        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = progressDiv.querySelector('.progress-bar');
        
        try {
            progressDiv.classList.remove('d-none');
            const totalFiles = selectedDriveFiles.size;
            let completedFiles = 0;
            
            batchStatus.innerHTML = `Processing 0/${totalFiles} files from Google Drive...`;
            
            for (const fileId of selectedDriveFiles) {
                const response = await fetch(`/drive/download/${fileId}`);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Create a File object from the downloaded content
                const blob = new Blob([data.content], { type: 'audio/mpeg' });
                const file = new File([blob], data.filename, { type: 'audio/mpeg' });
                
                // Upload the file using the existing upload endpoint
                const formData = new FormData();
                formData.append('file', file);
                
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    const error = await uploadResponse.json();
                    throw new Error(error.error || 'Upload failed');
                }
                
                completedFiles++;
                const progress = (completedFiles / totalFiles) * 100;
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
                batchStatus.innerHTML = `Processing ${completedFiles}/${totalFiles} files from Google Drive...`;
            }
            
            batchStatus.innerHTML += '<div class="alert alert-success">Google Drive files processing completed!</div>';
            driveModal.hide();
            
            // Reload the page after a short delay to show the new analyses
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Error processing Google Drive files:', error);
            batchStatus.innerHTML = `<div class="alert alert-danger">Error processing Google Drive files: ${error.message}</div>`;
        } finally {
            progressDiv.classList.add('d-none');
            progressBar.style.width = '0%';
        }
    });
});
