<!DOCTYPE html>
<html>
<head>
    <title>Audio Upload</title>
    <!-- Add jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script> 
    </head>
<body>

    <form id="uploadForm" enctype="multipart/form-data">
        <input type="file" id="audioFile" accept="audio/*">
        <button type="submit" id="uploadBtn" class="btn btn-primary">
            Upload
            <div class="spinner-border spinner-border-sm d-none" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
        </button>
    </form>

    <audio id="audioPlayer" controls></audio>
    <button id="playBtn" class="btn btn-secondary"><i class="bi bi-play-fill"></i></button>

    <script>
    $(document).ready(function() {
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

        // Initialize audio player only when elements exist
        const audioPlayer = document.getElementById('audioPlayer');
        const playBtn = document.getElementById('playBtn');
        if (playBtn && audioPlayer) {
            $(playBtn).on('click', function() {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                    $(this).html('<i class="bi bi-pause-fill"></i>');
                } else {
                    audioPlayer.pause();
                    $(this).html('<i class="bi bi-play-fill"></i>');
                }
            });
        }
    });
    </script>
</body>
</html>