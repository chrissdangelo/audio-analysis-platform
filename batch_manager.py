import logging
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from models import AudioAnalysis
from database import db

logger = logging.getLogger(__name__)

class BatchUploadManager:
    def __init__(self):
        self.batch_status: Dict[str, dict] = {}
        self.current_batch_id: Optional[str] = None

    def create_batch(self, file_list: List[str]) -> str:
        """Create a new batch with the given list of files."""
        batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.current_batch_id = batch_id

        # Initialize batch status with more detailed tracking
        self.batch_status[batch_id] = {
            'files': {
                filename: {
                    'status': 'pending',
                    'attempts': 0,
                    'error': None,
                    'analysis_id': None,
                    'processed_at': None,
                    'upload_progress': 0,  # Track individual file upload progress
                    'processing_progress': 0,  # Track processing progress
                    'current_operation': 'waiting'  # Current operation being performed
                } for filename in file_list
            },
            'total_files': len(file_list),
            'processed_files': 0,
            'failed_files': 0,
            'started_at': datetime.now().isoformat(),
            'completed_at': None,
            'overall_progress': 0,  # Track overall batch progress
            'is_cancelled': False  # Track if batch has been cancelled
        }
        logger.info(f"Created new batch {batch_id} with {len(file_list)} files")
        self.save_batch_status(batch_id)
        return batch_id

    def update_file_progress(self, batch_id: str, filename: str, 
                           upload_progress: Optional[float] = None,
                           processing_progress: Optional[float] = None,
                           operation: Optional[str] = None):
        """Update progress for a specific file."""
        if batch_id in self.batch_status:
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                if upload_progress is not None:
                    file_status['upload_progress'] = min(100, max(0, upload_progress))
                if processing_progress is not None:
                    file_status['processing_progress'] = min(100, max(0, processing_progress))
                if operation:
                    file_status['current_operation'] = operation

                # Calculate overall progress
                self._update_overall_progress(batch_id)
                # Save status after each update
                self.save_batch_status(batch_id)

    def _update_overall_progress(self, batch_id: str):
        """Update the overall progress of the batch."""
        if batch_id in self.batch_status:
            batch = self.batch_status[batch_id]
            total_files = batch['total_files']
            if total_files > 0:
                total_progress = 0
                for file_status in batch['files'].values():
                    # Weight upload and processing equally
                    file_progress = (file_status['upload_progress'] + 
                                   file_status['processing_progress']) / 2
                    total_progress += file_progress

                batch['overall_progress'] = round(total_progress / total_files, 2)

    def mark_file_started(self, batch_id: str, filename: str):
        """Mark a file as being processed."""
        if batch_id in self.batch_status and not self.batch_status[batch_id].get('is_cancelled'):
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                file_status['status'] = 'processing'
                file_status['attempts'] += 1
                file_status['current_operation'] = 'analyzing content'
                file_status['upload_progress'] = 100  # File is uploaded
                file_status['processing_progress'] = 0  # Start processing
                logger.info(f"Started processing {filename} (Attempt {file_status['attempts']})")
                self.save_batch_status(batch_id)

    def mark_file_complete(self, batch_id: str, filename: str, analysis_id: int):
        """Mark a file as successfully processed."""
        if batch_id in self.batch_status:
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                file_status['status'] = 'completed'
                file_status['analysis_id'] = analysis_id
                file_status['processed_at'] = datetime.now().isoformat()
                file_status['upload_progress'] = 100
                file_status['processing_progress'] = 100
                file_status['current_operation'] = 'completed'
                self.batch_status[batch_id]['processed_files'] += 1
                logger.info(f"Completed processing {filename}")

                # Update overall progress and check if batch is complete
                self._update_overall_progress(batch_id)
                if self._is_batch_complete(batch_id):
                    self.batch_status[batch_id]['completed_at'] = datetime.now().isoformat()
                    logger.info(f"Batch {batch_id} completed")

                self.save_batch_status(batch_id)

    def mark_file_failed(self, batch_id: str, filename: str, error: str):
        """Mark a file as failed with error message."""
        if batch_id in self.batch_status:
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                # Only mark as failed if we've exhausted retry attempts
                if file_status['attempts'] >= 3:
                    file_status['status'] = 'failed'
                    file_status['error'] = error
                    file_status['current_operation'] = 'failed'
                    file_status['upload_progress'] = 100  # File was uploaded
                    file_status['processing_progress'] = 100  # Processing ended (in failure)
                    self.batch_status[batch_id]['failed_files'] += 1
                    logger.error(f"Failed to process {filename} after {file_status['attempts']} attempts: {error}")
                else:
                    file_status['status'] = 'pending'
                    file_status['error'] = error
                    logger.warning(f"Processing attempt {file_status['attempts']} failed for {filename}: {error}")
                self.save_batch_status(batch_id)

    def cancel_batch(self, batch_id: str):
        """Cancel a batch upload."""
        if batch_id in self.batch_status:
            self.batch_status[batch_id]['is_cancelled'] = True
            # Mark all pending files as cancelled
            for filename, file_status in self.batch_status[batch_id]['files'].items():
                if file_status['status'] == 'pending':
                    file_status['status'] = 'cancelled'
                    file_status['current_operation'] = 'cancelled'
            self.save_batch_status(batch_id)
            logger.info(f"Cancelled batch {batch_id}")

    def get_pending_files(self, batch_id: str) -> List[str]:
        """Get list of files that still need processing."""
        if batch_id not in self.batch_status or self.batch_status[batch_id].get('is_cancelled'):
            return []

        return [
            filename for filename, status in 
            self.batch_status[batch_id]['files'].items()
            if (status['status'] == 'pending' or 'timeout' in str(status.get('error', '')).lower()) and status['attempts'] < 3
        ]

    def get_batch_status(self, batch_id: str) -> dict:
        """Get the current status of a batch."""
        return self.batch_status.get(batch_id, {})

    def _is_batch_complete(self, batch_id: str) -> bool:
        """Check if all files in the batch have been processed."""
        if batch_id not in self.batch_status:
            return False

        batch = self.batch_status[batch_id]
        completed_count = batch['processed_files'] + batch['failed_files']
        cancelled_count = sum(1 for file_status in batch['files'].values() 
                            if file_status['status'] == 'cancelled')
        return (completed_count + cancelled_count) == batch['total_files']

    def save_batch_status(self, batch_id: str):
        """Save batch status to file for persistence."""
        try:
            # Ensure data directory exists
            os.makedirs('data', exist_ok=True)

            status_json = json.dumps(self.batch_status[batch_id])
            with open(f'data/batch_{batch_id}_status.json', 'w') as f:
                f.write(status_json)
            logger.info(f"Saved status for batch {batch_id}")
        except Exception as e:
            logger.error(f"Failed to save batch status: {str(e)}")

    def load_batch_status(self, batch_id: str) -> bool:
        """Load batch status from file for resuming."""
        try:
            with open(f'data/batch_{batch_id}_status.json', 'r') as f:
                self.batch_status[batch_id] = json.loads(f.read())
            logger.info(f"Loaded status for batch {batch_id}")
            return True
        except FileNotFoundError:
            logger.warning(f"No saved status found for batch {batch_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to load batch status: {str(e)}")
            return False