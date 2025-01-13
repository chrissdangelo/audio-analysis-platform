document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = uploadBtn.querySelector('.spinner-border');
    const audioFileInput = document.getElementById('audioFile');
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade';
    errorAlert.setAttribute('role', 'alert');

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
        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
            showError('File is too large. Maximum size is 500MB');
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

            // Dispatch event for dashboard update
            document.dispatchEvent(new CustomEvent('analysisAdded'));

            // Remove any error messages
            const existingAlert = document.querySelector('.alert-danger');
            if (existingAlert) {
                existingAlert.remove();
            }

            uploadForm.reset();

        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        } finally {
            uploadBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    });

    // Only initialize audio player if needed
    function initAudioPlayer() {
        const playBtn = document.getElementById('playBtn');
        const audio = document.getElementById('audioPlayer');
        if (playBtn && audio) {
            playBtn.addEventListener('click', function() {
                if (audio.paused) {
                    audio.play();
                    playBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                } else {
                    audio.pause();
                    playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
                }
            });
        }
    }
    initAudioPlayer();
});