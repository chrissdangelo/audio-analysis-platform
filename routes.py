import os
import json
import logging
from flask import request, jsonify, render_template
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from database import db
from models import AudioAnalysis
from gemini_analyzer import GeminiAnalyzer
from batch_manager import BatchUploadManager

logger = logging.getLogger(__name__)
batch_manager = BatchUploadManager()

def title_case(s: str) -> str:
    """Convert string to title case, handling special characters"""
    return ' '.join(word.capitalize() for word in s.replace('_', ' ').replace('-', ' ').split())

ALLOWED_EXTENSIONS = {'mp3', 'wav', 'mp4', 'avi', 'mov'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def prepare_list_for_storage(value):
    """Prepare a list value for storage in the database"""
    if not value:
        return '[]'
    if isinstance(value, str):
        try:
            # If it's already a JSON string, validate it's a list
            parsed = json.loads(value)
            return json.dumps(parsed if isinstance(parsed, list) else [parsed])
        except json.JSONDecodeError:
            # Not JSON, treat as a single item
            return json.dumps([value])
    if isinstance(value, list):
        return json.dumps(value)
    # For any other type, wrap in a list
    return json.dumps([str(value)])

def register_routes(app):
    @app.route('/')
    def index():
        try:
            analyses = AudioAnalysis.query.order_by(AudioAnalysis.created_at.desc()).all()
            return render_template('index.html', analyses=analyses)
        except Exception as e:
            logger.error(f"Error fetching analyses: {str(e)}")
            return render_template('index.html', analyses=[])

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
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

                # Ensure upload directory exists
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

                file.save(filepath)
                logger.info(f"File saved successfully to {filepath}")

                # Create analyzer instance
                analyzer = GeminiAnalyzer()
                logger.info("Starting content analysis with Gemini")

                # Determine MIME type based on file extension
                file_ext = os.path.splitext(filename)[1].lower()
                mime_type = 'audio/wav' if file_ext == '.wav' else 'audio/mpeg'

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
                    file_type='Audio',
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
                    summary=analysis_result.get('summary', ''),
                    emotion_scores=json.dumps(analysis_result.get('emotion_scores', {
                        'joy': 0,
                        'sadness': 0,
                        'anger': 0,
                        'fear': 0,
                        'surprise': 0
                    })),
                    dominant_emotion=analysis_result.get('dominant_emotion', ''),
                    tone_analysis=json.dumps(analysis_result.get('tone_analysis', {})),
                    confidence_score=analysis_result.get('confidence_score', 0.0)
                )

                try:
                    db.session.add(analysis)
                    db.session.commit()
                    logger.info(f"Analysis saved to database for {filename}")
                except Exception as e:
                    logger.error(f"Database error: {str(e)}")
                    return jsonify({'error': 'Error saving analysis results'}), 500

                # Convert to dict for response
                response_data = analysis.to_dict()
                response_data['debug_url'] = f'/debug_analysis/{analysis.id}'

                return jsonify(response_data), 200

            except Exception as e:
                if "gemini api error" in str(e).lower():
                    logger.error(f"Gemini API error: {str(e)}")
                    return jsonify({'error': 'Content analysis service unavailable. Please try again later.'}), 503
                else:
                    logger.error(f"Error analyzing content: {str(e)}")
                    return jsonify({'error': 'Error analyzing audio content. Please ensure the file is not corrupted.'}), 400

        except RequestEntityTooLarge:
            logger.error("File too large")
            return jsonify({'error': 'File too large. Maximum file size is 100MB'}), 413
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            return jsonify({'error': 'An unexpected error occurred'}), 500
        finally:
            # Clean up resources
            if analyzer:
                try:
                    analyzer.cleanup()
                except Exception as e:
                    logger.error(f"Error cleaning up analyzer: {str(e)}")

            if filepath and os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    logger.info(f"Cleaned up uploaded file: {filepath}")
                except Exception as e:
                    logger.error(f"Error cleaning up file {filepath}: {str(e)}")

    @app.route('/api/analyses')
    def get_analyses():
        try:
            analyses = AudioAnalysis.query.order_by(AudioAnalysis.created_at.desc()).all()
            return jsonify([analysis.to_dict() for analysis in analyses])
        except Exception as e:
            logger.error(f"Error fetching analyses: {str(e)}")
            return jsonify({'error': 'Error fetching analyses'}), 500

    @app.route('/debug_analysis/<int:analysis_id>')
    def debug_analysis(analysis_id):
        try:
            analysis = AudioAnalysis.query.get_or_404(analysis_id)
            analysis_dict = analysis.to_dict()

            # Ensure emotion_scores is a dict
            if not analysis_dict.get('emotion_scores'):
                analysis_dict['emotion_scores'] = {
                    'joy': 0,
                    'sadness': 0,
                    'anger': 0,
                    'fear': 0,
                    'surprise': 0
                }

            # Ensure tone_analysis is a dict
            if not analysis_dict.get('tone_analysis'):
                analysis_dict['tone_analysis'] = {}

            # Handle missing or empty summary
            if not analysis_dict.get('summary'):
                # Try to get a summary from Gemini if missing
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

    @app.route('/api/search', methods=['POST'])
    def search_content():
        try:
            criteria = request.get_json()
            logger.debug(f"Search criteria received: {criteria}")

            # Start with all analyses
            query = AudioAnalysis.query

            # Apply theme filters if provided
            if criteria.get('themes'):
                theme_conditions = []
                for theme in criteria['themes']:
                    # Add logging to debug the theme search
                    logger.debug(f"Searching for theme: {theme}")
                    # Search for the theme within the JSON array
                    theme_conditions.append(
                        AudioAnalysis.themes.cast(db.Text).like(f'%"{theme}"%')
                    )
                query = query.filter(db.or_(*theme_conditions))

            # Apply character filters if provided
            if criteria.get('characters'):
                char_conditions = []
                for character in criteria['characters']:
                    logger.debug(f"Searching for character: {character}")
                    char_conditions.append(
                        AudioAnalysis.characters_mentioned.cast(db.Text).like(f'%"{character}"%')
                    )
                query = query.filter(db.or_(*char_conditions))

            # Apply environment filters if provided
            if criteria.get('environments'):
                env_conditions = []
                for environment in criteria['environments']:
                    logger.debug(f"Searching for environment: {environment}")
                    env_conditions.append(
                        AudioAnalysis.environments.cast(db.Text).like(f'%"{environment}"%')
                    )
                query = query.filter(db.or_(*env_conditions))

            # Execute query and convert results to dictionaries
            results = [analysis.to_dict() for analysis in query.all()]
            logger.debug(f"Search returned {len(results)} results")
            return jsonify(results)

        except Exception as e:
            logger.error(f"Error performing search: {str(e)}")
            return jsonify({"error": "Error performing search"}), 500

    @app.route('/api/analysis/<int:analysis_id>', methods=['DELETE'])
    def delete_analysis(analysis_id):
        """Delete an analysis record."""
        try:
            analysis = AudioAnalysis.query.get_or_404(analysis_id)
            db.session.delete(analysis)
            db.session.commit()
            logger.info(f"Deleted analysis {analysis_id}")
            return jsonify({'message': 'Analysis deleted successfully'}), 200
        except Exception as e:
            logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
            return jsonify({'error': 'Error deleting analysis'}), 500

    @app.route('/api/upload/batch', methods=['POST'])
    def upload_batch():
        try:
            files = request.files.getlist('files[]')
            if not files:
                logger.error("No files received in request")
                return jsonify({'error': 'No files uploaded'}), 400

            # Create uploads directory if it doesn't exist
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            os.makedirs('data', exist_ok=True)  # For batch status files

            # Filter out duplicates
            filenames = []
            duplicates = []
            for file in files:
                if file.filename and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    # Check if file already exists in database
                    existing = AudioAnalysis.query.filter_by(filename=filename).first()
                    if existing:
                        duplicates.append(filename)
                    else:
                        filenames.append(filename)

            if not filenames:
                message = "No valid files selected"
                if duplicates:
                    message += f". Duplicates found: {', '.join(duplicates)}"
                logger.error(message)
                return jsonify({'error': message}), 400

            batch_id = batch_manager.create_batch(filenames)
            logger.info(f"Created batch {batch_id} with {len(filenames)} files")

            # Save files
            saved_files = []
            try:
                for file in files:
                    if file.filename and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        if filename in filenames:  # Only save non-duplicate files
                            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                            file.save(filepath)
                            saved_files.append(filepath)
                            logger.info(f"Saved file {filename} for batch {batch_id}")
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
            from threading import Thread
            thread = Thread(target=process_batch, args=(app, batch_id))
            thread.daemon = True
            thread.start()

            return jsonify({
                'batch_id': batch_id,
                'message': 'Batch upload started',
                'status_url': f'/api/upload/batch/{batch_id}/status',
                'duplicates': duplicates
            }), 202

        except RequestEntityTooLarge:
            logger.error("File too large")
            return jsonify({'error': 'File too large. Maximum file size is 100MB'}), 413
        except Exception as e:
            logger.error(f"Unexpected error in batch upload: {str(e)}", exc_info=True)
            return jsonify({'error': 'An unexpected error occurred'}), 500

    @app.route('/api/upload/batch/<batch_id>/status')
    def batch_status(batch_id):
        status = batch_manager.get_batch_status(batch_id)
        if not status:
            return jsonify({'error': 'Batch not found'}), 404
        return jsonify(status)

    @app.route('/api/upload/batch/<batch_id>/retry')
    def retry_batch(batch_id):
        if not batch_manager.load_batch_status(batch_id):
            return jsonify({'error': 'Batch not found'}), 404

        # Start processing in a separate thread
        from threading import Thread
        thread = Thread(target=process_batch, args=(app, batch_id))
        thread.daemon = True
        thread.start()

        return jsonify({
            'message': 'Batch processing restarted',
            'status_url': f'/api/upload/batch/{batch_id}/status'
        }), 202

    @app.route('/api/update_missing_analysis', methods=['POST'])
    def update_missing_analysis():
        """Update records missing summaries and emotion scores."""
        try:
            # Get all records missing summaries or emotion scores
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

                    # Get missing summary if needed
                    if not analysis.summary:
                        summary_result = analyzer.generate_summary(analysis_dict)
                        analysis.summary = summary_result.get('summary', '')
                        logger.info(f"Generated summary for analysis {analysis.id}")

                    # Get missing emotion scores
                    if not analysis.emotion_scores or analysis.emotion_scores == '{}':
                        emotion_result = analyzer.analyze_emotions(analysis_dict)
                        analysis.emotion_scores = json.dumps(emotion_result['emotion_scores'])
                        analysis.dominant_emotion = emotion_result['dominant_emotion']
                        analysis.tone_analysis = json.dumps(emotion_result['tone_analysis'])
                        analysis.confidence_score = emotion_result['confidence_score']
                        logger.info(f"Updated emotion analysis for analysis {analysis.id}")

                    db.session.add(analysis)
                    updated_count += 1

                    # Commit every 5 records to avoid long transactions
                    if updated_count % 5 == 0:
                        db.session.commit()
                        logger.info(f"Committed batch of 5 updates, total: {updated_count}")

                except Exception as e:
                    logger.error(f"Error updating analysis {analysis.id}: {str(e)}")
                    continue

            # Final commit for remaining records
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


def process_batch(app, batch_id):
    """Process each file in the batch sequentially."""
    logger.info(f"Starting batch processing for batch {batch_id}")

    with app.app_context():
        while True:
            pending_files = batch_manager.get_pending_files(batch_id)
            if not pending_files:
                break

            for filename in pending_files:
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                if not os.path.exists(filepath):
                    batch_manager.mark_file_failed(batch_id, filename, "File not found")
                    continue

                batch_manager.mark_file_started(batch_id, filename)

                try:
                    # Create analyzer instance
                    analyzer = GeminiAnalyzer()

                    # Determine MIME type
                    file_ext = os.path.splitext(filename)[1].lower()
                    mime_type = 'audio/wav' if file_ext == '.wav' else 'audio/mpeg'

                    # Process with Gemini
                    analysis_result = analyzer.upload_to_gemini(filepath, mime_type)

                    # Prepare array fields for storage
                    for field in ['environments', 'characters_mentioned', 'speaking_characters', 'themes']:
                        if field in analysis_result:
                            analysis_result[field] = prepare_list_for_storage(analysis_result[field])

                    # Create database entry
                    analysis = AudioAnalysis(
                        title=title_case(os.path.splitext(filename)[0]),
                        filename=filename,
                        file_type='Audio',
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

                    batch_manager.mark_file_complete(batch_id, filename, analysis.id)

                except Exception as e:
                    logger.error(f"Error processing {filename}: {str(e)}")
                    batch_manager.mark_file_failed(batch_id, filename, str(e))

                finally:
                    if os.path.exists(filepath):
                        try:
                            os.remove(filepath)
                            logger.info(f"Cleaned up file {filepath}")
                        except Exception as e:
                            logger.error(f"Error cleaning up file {filepath}: {str(e)}")

                    if 'analyzer' in locals():
                        try:
                            analyzer.cleanup()
                        except Exception as e:
                            logger.error(f"Error cleaning up analyzer: {str(e)}")

                # Save batch status after each file
                batch_manager.save_batch_status(batch_id)

        logger.info(f"Completed batch processing for batch {batch_id}")