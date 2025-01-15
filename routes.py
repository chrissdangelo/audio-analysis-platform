import os
import json
import logging
from datetime import datetime, timedelta
from flask import request, jsonify, render_template, Response, current_app, g
from werkzeug.utils import secure_filename 
from werkzeug.exceptions import RequestEntityTooLarge
from database import db
from models import AudioAnalysis, GuestAccess
from gemini_analyzer import GeminiAnalyzer
from batch_manager import BatchUploadManager
from sqlalchemy import text
from functools import wraps
from threading import Thread

logger = logging.getLogger(__name__)
batch_manager = BatchUploadManager()

def title_case(s: str) -> str:
    """Convert string to title case, handling special characters"""
    return ' '.join(word.capitalize() for word in s.replace('_', ' ').replace('-', ' ').split())

ALLOWED_EXTENSIONS = {'mp3', 'wav', 'mp4', 'avi', 'mov', 'jpg', 'jpeg', 'png', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def prepare_list_for_storage(value):
    """Prepare a list value for storage in the database"""
    if not value:
        return '[]'
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return json.dumps(parsed if isinstance(parsed, list) else [parsed])
        except json.JSONDecodeError:
            return json.dumps([value])
    if isinstance(value, list):
        return json.dumps(value)
    return json.dumps([str(value)])

def get_mime_type(filename):
    """Helper function to determine MIME type based on file extension"""
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext == '.wav':
        return 'audio/wav'
    elif file_ext == '.mp3':
        return 'audio/mpeg'
    elif file_ext in ['.jpg', '.jpeg', '.png', '.gif']:
        return 'image/' + file_ext[1:]
    elif file_ext in ['.mp4', '.avi', '.mov']:
        return 'video/' + file_ext[1:]
    else:
        raise ValueError(f"Unsupported file type: {file_ext}")

def reset_sequence():
    """Resets the ID sequence for AudioAnalysis."""
    try:
        max_id = db.session.execute(text("""
            SELECT COALESCE(MAX(id), 0) FROM audio_analyses;
        """)).scalar()
        db.session.execute(text(f"""
            ALTER SEQUENCE audio_analyses_id_seq RESTART WITH {max_id + 1};
        """))
        db.session.commit()
        logger.info("Successfully reset ID sequence")
    except Exception as e:
        logger.error(f"Error resetting ID sequence: {str(e)}")
        db.session.rollback()

def require_auth(f):
    """Decorator to require guest authentication for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_token = request.args.get('access_token')

        if not auth_token:
            return jsonify({'error': 'No access token provided'}), 401

        guest_access = GuestAccess.query.filter_by(access_token=auth_token).first()

        if not guest_access or not guest_access.is_valid():
            return jsonify({'error': 'Invalid or expired access token'}), 401

        # Update last accessed time
        guest_access.last_accessed = datetime.utcnow()
        db.session.commit()

        # Store the guest access object in g for the route to use
        g.guest_access = guest_access
        return f(*args, **kwargs)
    return decorated_function

def register_routes(app):
    """Register all routes for the application"""

    # Public Routes
    @app.route('/')
    def index():
        """Main page route"""
        try:
            analyses = AudioAnalysis.query.order_by(AudioAnalysis.created_at.desc()).all()
            return render_template('index.html', analyses=analyses)
        except Exception as e:
            logger.error(f"Error fetching analyses: {str(e)}")
            return render_template('index.html', analyses=[])

    @app.route('/debug_analysis/<int:analysis_id>')
    def debug_analysis(analysis_id):
        """Debug view for a specific analysis"""
        try:
            analysis = AudioAnalysis.query.get_or_404(analysis_id)
            analysis_dict = analysis.to_dict()

            if not analysis_dict.get('emotion_scores'):
                analysis_dict['emotion_scores'] = {
                    'joy': 0, 'sadness': 0, 'anger': 0,
                    'fear': 0, 'surprise': 0
                }

            if not analysis_dict.get('tone_analysis'):
                analysis_dict['tone_analysis'] = {}

            if not analysis_dict.get('summary'):
                try:
                    analyzer = GeminiAnalyzer()
                    analysis_result = analyzer.generate_summary(analysis_dict)
                    analysis.summary = analysis_result.get('summary', '')
                    db.session.commit()
                    analysis_dict['summary'] = analysis.summary
                except Exception as e:
                    logger.error(f"Error generating summary: {str(e)}")
                    analysis_dict['summary'] = "Summary not available."

            return render_template('debug_analysis.html', analysis=analysis_dict)
        except Exception as e:
            logger.error(f"Error fetching analysis debug: {str(e)}")
            return jsonify({'error': 'Error fetching analysis debug info'}), 500

    # Guest Access Management Routes
    @app.route('/api/guest-access', methods=['POST'])
    def create_guest_access():
        """Create a new guest access token"""
        try:
            data = request.get_json()
            duration_days = data.get('duration_days', 7)  # Default to 7 days
            access_level = data.get('access_level', 'read-only')

            # Validate access level
            if access_level not in ['read-only', 'read-write']:
                return jsonify({'error': 'Invalid access level'}), 400

            # Generate new guest access
            guest_access = GuestAccess(
                access_token=GuestAccess.generate_token(),
                access_level=access_level,
                expires_at=datetime.utcnow() + timedelta(days=duration_days)
            )

            db.session.add(guest_access)
            db.session.commit()

            return jsonify({
                'message': 'Guest access created successfully',
                'access': guest_access.to_dict()
            }), 201

        except Exception as e:
            logger.error(f"Error creating guest access: {str(e)}")
            return jsonify({'error': 'Error creating guest access'}), 500

    @app.route('/api/guest-access/<token>/verify', methods=['GET'])
    def verify_guest_access(token):
        """Verify a guest access token"""
        try:
            guest_access = GuestAccess.query.filter_by(access_token=token).first()

            if not guest_access:
                return jsonify({'valid': False, 'error': 'Token not found'}), 404

            is_valid = guest_access.is_valid()
            response = {
                'valid': is_valid,
                'access': guest_access.to_dict() if is_valid else None
            }

            return jsonify(response), 200

        except Exception as e:
            logger.error(f"Error verifying guest access: {str(e)}")
            return jsonify({'error': 'Error verifying guest access'}), 500

    @app.route('/api/guest-access/<token>', methods=['DELETE'])
    def revoke_guest_access(token):
        """Revoke a guest access token"""
        try:
            guest_access = GuestAccess.query.filter_by(access_token=token).first()

            if not guest_access:
                return jsonify({'error': 'Token not found'}), 404

            guest_access.is_active = False
            db.session.commit()

            return jsonify({'message': 'Guest access revoked successfully'}), 200

        except Exception as e:
            logger.error(f"Error revoking guest access: {str(e)}")
            return jsonify({'error': 'Error revoking guest access'}), 500

    # Protected Analysis Routes
    @app.route('/api/analyses', methods=['GET'])
    @require_auth
    def get_analyses():
        """Get all analyses with authentication"""
        try:
            analyses = AudioAnalysis.query.order_by(AudioAnalysis.created_at.desc()).all()
            return jsonify([analysis.to_dict() for analysis in analyses])
        except Exception as e:
            logger.error(f"Error fetching analyses: {str(e)}")
            return jsonify({'error': 'Error fetching analyses'}), 500

    @app.route('/api/analysis/<int:analysis_id>', methods=['GET'])
    @require_auth
    def get_analysis(analysis_id):
        """Get a specific analysis with authentication"""
        try:
            analysis = AudioAnalysis.query.get_or_404(analysis_id)
            return jsonify(analysis.to_dict())
        except Exception as e:
            logger.error(f'Error fetching analysis {analysis_id}: {str(e)}')
            return jsonify({'error': 'Error fetching analysis'}), 500

    @app.route('/api/analysis/<int:analysis_id>', methods=['DELETE'])
    @require_auth
    def delete_analysis(analysis_id):
        """Delete an analysis with authentication"""
        try:
            analysis = AudioAnalysis.query.get_or_404(analysis_id)
            db.session.delete(analysis)
            db.session.commit()
            reset_sequence()
            return jsonify({'message': 'Analysis deleted successfully'}), 200
        except Exception as e:
            logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
            return jsonify({'error': 'Error deleting analysis'}), 500

    @app.route('/api/analysis/<int:analysis_id>/update_title', methods=['POST'])
    @require_auth
    def update_analysis_title(analysis_id):
        """Update the title of an analysis with authentication"""
        try:
            data = request.get_json()
            if not data or 'title' not in data:
                return jsonify({'error': 'Title is required'}), 400

            analysis = AudioAnalysis.query.get_or_404(analysis_id)
            analysis.title = data['title']
            db.session.commit()

            return jsonify({
                'message': 'Title updated successfully',
                'title': analysis.title
            }), 200
        except Exception as e:
            logger.error(f"Error updating title for analysis {analysis_id}: {str(e)}")
            db.session.rollback()
            return jsonify({'error': 'Error updating title'}), 500

    @app.route('/api/export_csv', methods=['GET'])
    @require_auth
    def export_csv():
        """Export analyses to CSV with authentication"""
        try:
            analyses = AudioAnalysis.query.order_by(AudioAnalysis.created_at.desc()).all()
            output = "ID,Title,Filename,Format,Duration,Has Narration,Has Music,Has Sound Effects,Songs Count,Environments,Characters,Themes\n"

            for analysis in analyses:
                environments = "|".join(analysis._parse_list_field(analysis.environments))
                characters = "|".join(analysis._parse_list_field(analysis.characters_mentioned))
                themes = "|".join(analysis._parse_list_field(analysis.themes))

                row = f"{analysis.id},{analysis.title},{analysis.filename},{analysis.format},"
                row += f"{analysis.duration},{analysis.has_narration},{analysis.has_underscore},"
                row += f"{analysis.has_sound_effects},{analysis.songs_count},"
                row += f"\"{environments}\",\"{characters}\",\"{themes}\"\n"
                output += row

            return Response(
                output,
                mimetype="text/csv",
                headers={"Content-disposition": "attachment; filename=content_export.csv"}
            )
        except Exception as e:
            logger.error(f"Error exporting CSV: {str(e)}")
            return jsonify({'error': 'Error exporting data'}), 500

    @app.route('/api/update_missing_analysis', methods=['POST'])
    @require_auth
    def update_missing_analysis():
        """Update records missing transcripts, summaries and emotion scores"""
        try:
            analyses = AudioAnalysis.query.filter(
                db.or_(
                    AudioAnalysis.summary.is_(None),
                    AudioAnalysis.summary == '',
                    AudioAnalysis.emotion_scores == '{}',
                    AudioAnalysis.emotion_scores.is_(None)
                )
            ).all()

            if not analyses:
                logger.info("No records found needing updates")
                return jsonify({'message': 'No records need updating'}), 200

            logger.info(f"Found {len(analyses)} records to update")
            analyzer = GeminiAnalyzer()

            updated_count = 0
            for analysis in analyses:
                try:
                    analysis_dict = analysis.to_dict()

                    if (not analysis.summary or analysis.summary == '') and analysis.transcript:
                        summary_result = analyzer.regenerate_summary(analysis_dict)
                        analysis.summary = summary_result.get('summary', '')
                        logger.info(f"Generated summary from transcript for analysis {analysis.id}")

                    if not analysis.emotion_scores or analysis.emotion_scores == '{}':
                        emotion_result = analyzer.analyze_emotions(analysis_dict)
                        analysis.emotion_scores = json.dumps(emotion_result['emotion_scores'])
                        analysis.dominant_emotion = emotion_result['dominant_emotion']
                        analysis.tone_analysis = json.dumps(emotion_result['tone_analysis'])
                        analysis.confidence_score = emotion_result['confidence_score']
                        logger.info(f"Updated emotion analysis for analysis {analysis.id}")

                    db.session.add(analysis)
                    updated_count += 1

                    if updated_count % 5 == 0:
                        db.session.commit()
                        logger.info(f"Committed batch of 5 updates, total: {updated_count}")

                except Exception as e:
                    logger.error(f"Error updating analysis {analysis.id}: {str(e)}")
                    continue

            db.session.commit()
            logger.info(f"Successfully updated {updated_count} records")

            return jsonify({
                'message': f'Successfully updated {updated_count} records',
                'total_processed': len(analyses),
                'successfully_updated': updated_count
            }), 200

        except Exception as e:
            logger.error(f"Error in update_missing_analysis: {str(e)}")
            return jsonify({'error': 'Error updating records'}), 500

    @app.route('/api/regenerate_summary/<int:analysis_id>', methods=['POST'])
    @require_auth
    def regenerate_summary(analysis_id):
        """Regenerate summary for a specific analysis"""
        try:
            analysis = AudioAnalysis.query.get_or_404(analysis_id)

            if not analysis.transcript:
                logger.warning(f"Cannot regenerate summary for analysis {analysis_id} - no transcript available")
                return jsonify({'error': 'No transcript available for this analysis'}), 400

            analyzer = GeminiAnalyzer()
            analysis_dict = analysis.to_dict()

            try:
                summary_result = analyzer.regenerate_summary(analysis_dict)
                analysis.summary = summary_result.get('summary', '')
                db.session.commit()
                logger.info(f"Successfully regenerated summary for analysis {analysis_id}")

                return jsonify({
                    'message': 'Summary regenerated successfully',
                    'summary': analysis.summary
                }), 200

            except Exception as e:
                logger.error(f"Error regenerating summary for analysis {analysis_id}: {str(e)}")
                return jsonify({'error': f'Error regenerating summary: {str(e)}'}), 500

        except Exception as e:
            logger.error(f"Error in regenerate_summary endpoint: {str(e)}")
            return jsonify({'error': 'Error processing request'}), 500

    @app.route('/api/reassign_ids', methods=['POST'])
    @require_auth
    def reassign_ids():
        """Reassign analysis IDs to be sequential"""
        try:
            db.session.execute(text("""
                CREATE TEMPORARY TABLE id_mapping AS
                SELECT id as old_id,
                       ROW_NUMBER() OVER (ORDER BY created_at, id) as new_id
                FROM audio_analyses;
            """))

            db.session.execute(text("""
                UPDATE audio_analyses a
                SET id = m.new_id
                FROM id_mapping m
                WHERE a.id = m.old_id;
            """))

            max_id = db.session.execute(text("""
                SELECT COALESCE(MAX(id), 0) + 1 FROM audio_analyses;
            """)).scalar()
            db.session.execute(text(f"""
                ALTER SEQUENCE audio_analyses_id_seq RESTART WITH {max_id};
            """))

            db.session.commit()
            logger.info("Successfully reassigned IDs")
            return jsonify({'message': 'IDs reassigned successfully'}), 200

        except Exception as e:
            logger.error(f"Error reassigning IDs: {str(e)}")
            db.session.rollback()
            return jsonify({'error': 'Failed to reassign IDs'}), 500

    # File Upload and Processing Routes
    @app.route('/api/upload', methods=['POST'])
    def upload_file():
        filepath = None
        analyzer = None
        try:
            if 'file' not in request.files:
                logger.error("No file part in request")
                return jsonify({'error': 'No file part'}), 400

            file = request.files['file']
            if file.filename == '':
                logger.error("No selected file")
                return jsonify({'error': 'No selected file'}), 400

            if not allowed_file(file.filename):
                logger.error(f"File type not allowed: {file.filename}")
                return jsonify({'error': f'File type not allowed. Allowed types are: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

            try:
                filename = secure_filename(file.filename)
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

                # Check for existing analysis
                existing = AudioAnalysis.query.filter_by(filename=filename).first()
                if existing:
                    logger.warning(f"File {filename} already processed")
                    return jsonify({'error': 'File has already been processed'}), 400

                # Ensure upload directory exists
                os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)

                file.save(filepath)
                logger.info(f"File saved successfully to {filepath}")

                # Create analyzer instance
                analyzer = GeminiAnalyzer()
                logger.info("Starting content analysis with Gemini")

                # Get MIME type
                try:
                    mime_type = get_mime_type(filename)
                    logger.info(f"Determined MIME type: {mime_type}")
                except ValueError as e:
                    return jsonify({'error': str(e)}), 400

                analysis_result = analyzer.upload_to_gemini(filepath, mime_type)
                logger.debug(f"Raw analysis result: {analysis_result}")

                # Prepare array fields for storage
                for field in ['environments', 'characters_mentioned', 'speaking_characters', 'themes']:
                    if field in analysis_result:
                        analysis_result[field] = prepare_list_for_storage(analysis_result[field])

                # Create database entry
                analysis = AudioAnalysis(
                    title=title_case(os.path.splitext(filename)[0]),
                    filename=filename,
                    file_type='Audio' if mime_type.startswith(('audio/', 'video/')) else 'Image',
                    format=analysis_result.get('format', 'narrated episode'),
                    duration=analysis_result.get('duration', '00:00:00'),
                    has_narration=analysis_result.get('has_narration', False),
                    has_underscore=analysis_result.get('has_underscore', False),
                    has_sound_effects=analysis_result.get('sound_effects_count', 0) > 0,
                    songs_count=analysis_result.get('songs_count', 0),
                    environments=analysis_result.get('environments', '[]'),
                    characters_mentioned=analysis_result.get('characters_mentioned', '[]'),
                    speaking_characters=analysis_result.get('speaking_characters', '[]'),
                    themes=analysis_result.get('themes', '[]'),
                    transcript=analysis_result.get('transcript', ''),
                    summary=analysis_result.get('summary', ''),
                    emotion_scores=json.dumps(analysis_result.get('emotion_scores', {
                        'joy': 0, 'sadness': 0, 'anger': 0,
                        'fear': 0, 'surprise': 0
                    })),
                    dominant_emotion=analysis_result.get('dominant_emotion', ''),
                    tone_analysis=json.dumps(analysis_result.get('tone_analysis', {})),
                    confidence_score=analysis_result.get('confidence_score', 0.0)
                )

                db.session.add(analysis)
                db.session.commit()
                logger.info(f"Analysis saved to database for {filename}")

                # Convert to dict for response
                response_data = analysis.to_dict()
                response_data['debug_url'] = f'/debug_analysis/{analysis.id}'

                return jsonify(response_data), 200

            except Exception as e:
                if "gemini api error" in str(e).lower():
                    logger.error(f"Gemini API error: {str(e)}")
                    return jsonify({'error': 'Content analysis service unavailable. Please try again later.'}), 503
                else:
                    logger.error(f"Error analyzing content: {str(e)}", exc_info=True)
                    return jsonify({'error': f'Error analyzing content: {str(e)}'}), 400

        except RequestEntityTooLarge:
            logger.error("File too large")
            return jsonify({'error': 'File too large. Maximum file size is 100MB'}), 413
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500
        finally:
            # Clean up analyzer resources
            if analyzer:
                try:
                    analyzer.cleanup()
                except Exception as e:
                    logger.error(f"Error cleaning up analyzer: {str(e)}")

            # Only clean up file if processing was successful
            if filepath and os.path.exists(filepath) and 'analysis' in locals() and analysis.id:
                try:
                    os.remove(filepath)
                    logger.info(f"Cleaned up successfully processed file: {filepath}")
                except Exception as e:
                    logger.error(f"Error cleaning up file {filepath}: {str(e)}")

    @app.route('/api/upload/batch', methods=['POST'])
    def upload_batch():
        try:
            files = request.files.getlist('files[]')
            if not files:
                logger.error("No files received in request")
                return jsonify({'error': 'No files uploaded'}), 400

            # Create uploads directory if it doesn't exist
            os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
            os.makedirs('data', exist_ok=True)  # For batch status files

            # Filter out duplicates and check file sizes
            filenames = []
            duplicates = []
            invalid_types = []
            total_size = 0

            for file in files:
                if not file.filename:
                    continue

                filename = secure_filename(file.filename)
                file.seek(0, os.SEEK_END)
                size = file.tell()
                file.seek(0)

                if not allowed_file(file.filename):
                    invalid_types.append(filename)
                    continue

                total_size += size
                if total_size > 500 * 1024 * 1024:  # 500MB total batch limit
                    return jsonify({'error': 'Total batch size exceeds 500MB limit'}), 413

                # Check if file already exists in database
                existing = AudioAnalysis.query.filter_by(filename=filename).first()
                if existing:
                    duplicates.append(filename)
                else:
                    filenames.append(filename)

            if invalid_types:
                return jsonify({
                    'error': f'Invalid file types: {", ".join(invalid_types)}. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
                }), 400

            if not filenames:
                message = "No valid files selected"
                if duplicates:
                    message += f". Duplicates found: {', '.join(duplicates)}"
                logger.error(message)
                return jsonify({'error': message}), 400

            batch_id = batch_manager.create_batch(filenames)
            logger.info(f"Created batch {batch_id} with {len(filenames)} files")

            # Save files and verify they exist
            saved_files = []
            try:
                for file in files:
                    if file.filename and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        if filename in filenames:  # Only save non-duplicate files
                            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                            file.save(filepath)
                            # Verify file was saved
                            if not os.path.exists(filepath):
                                raise IOError(f"Failed to save file {filename}")
                            saved_files.append(filepath)
                            logger.info(f"Saved and verified file {filename} for batch {batch_id}")

                # Double check all files exist before starting batch
                missing_files = [f for f in saved_files if not os.path.exists(f)]
                if missing_files:
                    raise IOError(f"Files missing after save: {', '.join(missing_files)}")

            except Exception as e:
                logger.error(f"Error saving files: {str(e)}")
                # Clean up any saved files
                for filepath in saved_files:
                    try:
                        if os.path.exists(filepath):
                            os.remove(filepath)
                    except Exception as cleanup_error:
                        logger.error(f"Error cleaning up file {filepath}: {str(cleanup_error)}")
                return jsonify({'error': 'Error saving files'}), 500

            # Start processing in a separate thread
            def process_with_context():
                with app.app_context():
                    process_batch(app, batch_id)

            thread = Thread(target=process_with_context)
            thread.daemon = True
            thread.start()

            return jsonify({
                'batch_id': batch_id,
                'message': 'Batch upload started',
                'status_url': f'/api/upload/batch/{batch_id}/status',
                'duplicates': duplicates if duplicates else [],
                'files': filenames
            }), 202

        except RequestEntityTooLarge:
            logger.error("File too large")
            return jsonify({'error': 'File too large. Maximum file size is 500MB'}), 413
        except Exception as e:
            logger.error(f"Unexpected error in batch upload: {str(e)}", exc_info=True)
            return jsonify({'error': 'An unexpected error occurred during batch upload'}), 500

    @app.route('/api/upload/batch/<batch_id>/status')
    def batch_status(batch_id):
        """Get the status of a batch upload."""
        try:
            status = batch_manager.get_batch_status(batch_id)
            if not status:
                logger.error(f"Batch {batch_id} not found")
                return jsonify({'error': 'Batch not found'}), 404

            # Calculate progress percentage
            total_files = len(status['files'])
            completed = len([f for f in status['files'].values()
                             if f.get('status') in ['completed', 'failed']])
            progress = (completed / total_files * 100) if total_files > 0 else 0

            # Add progress information to status
            status['progress'] = progress
            status['total_files'] = total_files
            status['completed_files'] = completed
            status['is_complete'] = completed == total_files

            logger.debug(f"Batch {batch_id} status: {status}")
            return jsonify(status)
        except Exception as e:
            logger.error(f"Error getting batch status: {str(e)}")
            return jsonify({'error': 'Error getting batch status'}), 500

    @app.route('/api/upload/batch/<batch_id>/retry')
    def retry_batch(batch_id):
        """Retry failed files in a batch."""
        try:
            status = batch_manager.load_batch_status(batch_id)
            if not status:
                return jsonify({'error': 'Batch not found'}), 404

            # Reset failed files to pending
            for filename, file_status in status['files'].items():
                if file_status['status'] == 'failed':
                    file_status['status'] = 'pending'
                    file_status['error'] = None
                    file_status['attempts'] = 0
            batch_manager.save_batch_status(batch_id)

            # Start processing in a separate thread
            def process_with_context():
                with app.app_context():
                    process_batch(app, batch_id)

            thread = Thread(target=process_with_context)
            thread.daemon = True
            thread.start()

            return jsonify({
                'message': 'Batch processing restarted',
                'status_url': f'/api/upload/batch/{batch_id}/status'
            }), 202

        except Exception as e:
            logger.error(f"Error retrying batch: {str(e)}")
            return jsonify({'error': 'Error retrying batch'}), 500

    @app.route('/api/upload/batch/<batch_id>/cancel', methods=['POST'])
    def cancel_batch(batch_id):
        """Cancel a batch upload."""
        try:
            batch_manager.cancel_batch(batch_id)
            return jsonify({'message': 'Batch cancelled successfully'}), 200
        except Exception as e:
            logger.error(f"Error cancelling batch: {str(e)}")
            return jsonify({'error': 'Error cancelling batch'}), 500

    def process_batch(app, batch_id):
        """Process each file in the batch sequentially."""
        logger.info(f"Starting batch processing for batch {batch_id}")

        with app.app_context():
            try:
                pending_files = batch_manager.get_pending_files(batch_id)
                if not pending_files:
                    logger.info(f"No pending files found for batch {batch_id}")
                    return

                for filename in pending_files:
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    process_single_file(app, batch_id, filename, filepath)

                logger.info(f"Completed batch processing for batch {batch_id}")

            except Exception as e:
                logger.error(f"Error in batch processing: {str(e)}")
                batch_manager.mark_batch_failed(batch_id, str(e))

    def process_single_file(app, batch_id, filename, filepath):
        """Process a single file from a batch."""
        analyzer = None
        try:
            # Create analyzer instance
            analyzer = GeminiAnalyzer()
            logger.info(f"Starting content analysis for file {filename} in batch {batch_id}")

            # Get MIME type
            mime_type = get_mime_type(filename)
            logger.info(f"Determined MIME type: {mime_type}")

            analysis_result = analyzer.upload_to_gemini(filepath, mime_type)
            logger.debug(f"Raw analysis result: {analysis_result}")

            # Prepare array fields for storage
            for field in ['environments', 'characters_mentioned', 'speaking_characters', 'themes']:
                if field in analysis_result:
                    analysis_result[field] = prepare_list_for_storage(analysis_result[field])

            # Create database entry
            analysis = AudioAnalysis(
                title=title_case(os.path.splitext(filename)[0]),
                filename=filename,
                file_type='Audio' if mime_type.startswith(('audio/', 'video/')) else 'Image',
                format=analysis_result.get('format', 'narrated episode'),
                duration=analysis_result.get('duration', '00:00:00'),
                has_narration=analysis_result.get('has_narration', False),
                has_underscore=analysis_result.get('has_underscore', False),
                has_sound_effects=analysis_result.get('sound_effects_count', 0) > 0,
                songs_count=analysis_result.get('songs_count', 0),
                environments=analysis_result.get('environments', '[]'),
                characters_mentioned=analysis_result.get('characters_mentioned', '[]'),
                speaking_characters=analysis_result.get('speaking_characters', '[]'),
                themes=analysis_result.get('themes', '[]'),
                transcript=analysis_result.get('transcript', ''),
                summary=analysis_result.get('summary', ''),
                emotion_scores=json.dumps(analysis_result.get('emotion_scores', {
                    'joy': 0, 'sadness': 0, 'anger': 0,
                    'fear': 0, 'surprise': 0
                })),
                dominant_emotion=analysis_result.get('dominant_emotion', ''),
                tone_analysis=json.dumps(analysis_result.get('tone_analysis', {})),
                confidence_score=analysis_result.get('confidence_score', 0.0)
            )

            db.session.add(analysis)
            db.session.commit()
            logger.info(f"Analysis saved to database for {filename}")
            batch_manager.mark_file_complete(batch_id, filename)

        except Exception as e:
            logger.error(f"Error processing file {filename}: {str(e)}")
            batch_manager.mark_file_failed(batch_id, filename, str(e))
        finally:
            # Clean up analyzer resources
            if analyzer:
                try:
                    analyzer.cleanup()
                except Exception as e:
                    logger.error(f"Error cleaning up analyzer: {str(e)}")

            # Clean up file
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    logger.info(f"Cleaned up processed file: {filepath}")
                except Exception as e:
                    logger.error(f"Error cleaning up file {filepath}: {str(e)}")

    @app.route('/search')
    def search_page():
        return render_template('search.html')

    @app.route('/api/search', methods=['GET', 'POST'])
    def search_content():
        try:
            # Handle both GET and POST methods
            if request.method == 'GET':
                criteria = {
                    'themes': request.args.get('themes', '').split(',') if request.args.get('themes') else [],
                    'characters': request.args.get('characters', '').split(',') if request.args.get('characters') else [],
                    'environments': request.args.get('environments', '').split(',') if request.args.get('environments') else []
                }
            else:
                criteria = request.get_json()

            logger.debug(f"Search criteria received: {criteria}")

            # Start with all analyses
            query = AudioAnalysis.query

            # Apply theme filters if provided
            if criteria.get('themes'):
                theme_conditions = []
                for theme in criteria['themes']:
                    if theme:  # Skip empty strings
                        theme = theme.lower()  # Case-insensitive search
                        theme_conditions.append(
                            db.func.lower(AudioAnalysis.themes).like(f'%"{theme}"%')
                        )
                if theme_conditions:
                    query = query.filter(db.or_(*theme_conditions))

            # Apply character filters if provided
            if criteria.get('characters'):
                char_conditions = []
                for character in criteria['characters']:
                    if character:  # Skip empty strings
                        character = character.lower()  # Case-insensitive search
                        logger.debug(f"Searching for character: {character}")
                        char_conditions.append(
                            db.func.lower(AudioAnalysis.characters_mentioned).like(f'%"{character}"%')
                        )
                if char_conditions:
                    query = query.filter(db.or_(*char_conditions))

            # Apply environment filters if provided
            if criteria.get('environments'):
                env_conditions = []
                for environment in criteria['environments']:
                    if environment:  # Skip empty strings
                        environment = environment.lower()  # Case-insensitive search
                        logger.debug(f"Searching for environment: {environment}")
                        env_conditions.append(
                            db.func.lower(AudioAnalysis.environments).like(f'%"{environment}"%')
                        )
                if env_conditions:
                    query = query.filter(db.or_(*env_conditions))

            # Execute query and convert results to dictionaries
            results = [analysis.to_dict() for analysis in query.all()]
            logger.debug(f"Search returned {len(results)} results")
            return jsonify(results)

        except Exception as e:
            logger.error(f"Error performing search: {str(e)}")
            return jsonify({"error": "Error performing search"}), 500

    @app.route('/api/bundle-suggestions', methods=['GET'])
    @require_auth
    def get_bundle_suggestions():
        """Get bundle suggestions based on size and criteria"""
        try:
            # Get parameters
            bundle_size = request.args.get('bundle_size', type=int, default=3)
            selected_themes = request.args.getlist('themes[]')
            selected_characters = request.args.getlist('characters[]')
            selected_environments = request.args.getlist('environments[]')

            # Start with all analyses
            query = AudioAnalysis.query

            # Apply filters if provided
            if selected_themes:
                query = query.filter(AudioAnalysis.themes.cast(JSONB).contains(selected_themes))
            if selected_characters:
                query = query.filter(AudioAnalysis.characters_mentioned.cast(JSONB).contains(selected_characters))
            if selected_environments:
                query = query.filter(AudioAnalysis.environments.cast(JSONB).contains(selected_environments))

            # Get all matching analyses
            analyses = query.all()

            # Group analyses into bundles of specified size
            bundles = []
            current_bundle = []

            for analysis in analyses:
                current_bundle.append(analysis.to_dict())
                if len(current_bundle) == bundle_size:
                    bundles.append({
                        'id': len(bundles) + 1,
                        'items': current_bundle,
                        'total_duration': sum(
                            sum(int(x) * (60 if i == 0 else 1) 
                                for i, x in enumerate(item['duration'].split(':')[-2:]))
                            for item in current_bundle
                        ),
                        'common_themes': list(set.intersection(*[
                            set(json.loads(item['themes'])) 
                            for item in current_bundle 
                            if json.loads(item['themes'])
                        ])) if current_bundle else [],
                        'environments': list(set.union(*[
                            set(json.loads(item['environments'])) 
                            for item in current_bundle
                            if json.loads(item['environments'])
                        ])) if current_bundle else []
                    })
                    current_bundle = []

            logger.info(f"Generated {len(bundles)} bundle suggestions")
            return jsonify({
                'bundles': bundles,
                'total_matches': len(analyses),
                'bundle_count': len(bundles)
            }), 200

        except Exception as e:
            logger.error(f"Error generating bundle suggestions: {str(e)}")
            return jsonify({'error': 'Error generating bundle suggestions'}), 500

    return app