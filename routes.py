import os
import json
import logging
from flask import request, jsonify, render_template
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from database import db
from models import AudioAnalysis
from gemini_analyzer import GeminiAnalyzer

logger = logging.getLogger(__name__)

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
                    themes=analysis_result.get('themes', '[]')
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
            return render_template('debug_analysis.html', analysis=analysis.to_dict())
        except Exception as e:
            logger.error(f"Error fetching analysis debug: {str(e)}")
            return jsonify({'error': 'Error fetching analysis debug info'}), 500

    @app.route('/api/search', methods=['POST'])
    def search_content():
        try:
            criteria = request.get_json()

            # Start with all analyses
            query = AudioAnalysis.query

            # Apply theme filters if provided
            if criteria.get('themes'):
                # Filter for analyses that have any of the selected themes
                theme_conditions = []
                for theme in criteria['themes']:
                    theme_conditions.append(AudioAnalysis.themes.contains(json.dumps([theme])))
                query = query.filter(db.or_(*theme_conditions))

            # Apply character filters if provided
            if criteria.get('characters'):
                # Filter for analyses that have any of the selected characters
                char_conditions = []
                for character in criteria['characters']:
                    char_conditions.append(AudioAnalysis.characters_mentioned.contains(json.dumps([character])))
                query = query.filter(db.or_(*char_conditions))

            # Apply environment filters if provided
            if criteria.get('environments'):
                # Filter for analyses that have any of the selected environments
                env_conditions = []
                for environment in criteria['environments']:
                    env_conditions.append(AudioAnalysis.environments.contains(json.dumps([environment])))
                query = query.filter(db.or_(*env_conditions))

            # Execute query and convert results to dictionaries
            results = [analysis.to_dict() for analysis in query.all()]
            return jsonify(results)

        except Exception as e:
            logger.error(f"Error performing search: {str(e)}")
            return jsonify({"error": "Error performing search"}), 500