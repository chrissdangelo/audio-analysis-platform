import logging
import json
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
        self.batch_status[batch_id] = {
            'files': {
                filename: {
                    'status': 'pending',
                    'attempts': 0,
                    'error': None,
                    'analysis_id': None,
                    'processed_at': None
                } for filename in file_list
            },
            'total_files': len(file_list),
            'processed_files': 0,
            'failed_files': 0,
            'started_at': datetime.now().isoformat(),
            'completed_at': None
        }
        logger.info(f"Created new batch {batch_id} with {len(file_list)} files")
        return batch_id

    def mark_file_started(self, batch_id: str, filename: str):
        """Mark a file as being processed."""
        if batch_id in self.batch_status:
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                file_status['status'] = 'processing'
                file_status['attempts'] += 1
                logger.info(f"Started processing {filename} (Attempt {file_status['attempts']})")

    def mark_file_complete(self, batch_id: str, filename: str, analysis_id: int):
        """Mark a file as successfully processed."""
        if batch_id in self.batch_status:
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                file_status['status'] = 'completed'
                file_status['analysis_id'] = analysis_id
                file_status['processed_at'] = datetime.now().isoformat()
                self.batch_status[batch_id]['processed_files'] += 1
                logger.info(f"Completed processing {filename}")

                # Check if batch is complete
                if self._is_batch_complete(batch_id):
                    self.batch_status[batch_id]['completed_at'] = datetime.now().isoformat()
                    logger.info(f"Batch {batch_id} completed")

    def mark_file_failed(self, batch_id: str, filename: str, error: str):
        """Mark a file as failed with error message."""
        if batch_id in self.batch_status:
            file_status = self.batch_status[batch_id]['files'].get(filename)
            if file_status:
                file_status['status'] = 'failed'
                file_status['error'] = error
                self.batch_status[batch_id]['failed_files'] += 1
                logger.error(f"Failed to process {filename}: {error}")

    def get_pending_files(self, batch_id: str) -> List[str]:
        """Get list of files that still need processing."""
        if batch_id not in self.batch_status:
            return []

        return [
            filename for filename, status in 
            self.batch_status[batch_id]['files'].items()
            if status['status'] in ['pending', 'failed'] and status['attempts'] < 3
        ]

    def get_batch_status(self, batch_id: str) -> dict:
        """Get the current status of a batch."""
        return self.batch_status.get(batch_id, {})

    def _is_batch_complete(self, batch_id: str) -> bool:
        """Check if all files in the batch have been processed."""
        if batch_id not in self.batch_status:
            return False

        batch = self.batch_status[batch_id]
        return (batch['processed_files'] + batch['failed_files']) == batch['total_files']

    def save_batch_status(self, batch_id: str):
        """Save batch status to database for persistence."""
        try:
            status_json = json.dumps(self.batch_status[batch_id])
            with open(f'data/batch_{batch_id}_status.json', 'w') as f:
                f.write(status_json)
            logger.info(f"Saved status for batch {batch_id}")
        except Exception as e:
            logger.error(f"Failed to save batch status: {str(e)}")

    def load_batch_status(self, batch_id: str) -> bool:
        """Load batch status from database for resuming."""
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