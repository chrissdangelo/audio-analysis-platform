import os
import logging
from flask import Flask
from flask_migrate import Migrate
from database import db

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Application factory function."""
    try:
        app = Flask(__name__)
        logger.info("Created Flask application")

        # Configure Flask app
        app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"

        # Configure database
        if not os.environ.get("DATABASE_URL"):
            logger.error("DATABASE_URL environment variable is not set")
            raise ValueError("DATABASE_URL environment variable is not set")

        app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_recycle": 300,
            "pool_pre_ping": True,
        }
        app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
        app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # Increased to 500MB
        app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
        logger.info("Configured Flask application settings")

        # Ensure upload directory exists
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        logger.info(f"Created upload directory at {app.config['UPLOAD_FOLDER']}")

        # Initialize database
        logger.info("Initializing database...")
        db.init_app(app)
        migrate = Migrate(app, db)
        logger.info("Initialized database and migrations")

        with app.app_context():
            # Import models here to ensure they're registered with SQLAlchemy
            from models import AudioAnalysis  # noqa: F401
            logger.info("Imported models")

            # Create tables if they don't exist
            db.create_all()
            logger.info("Created database tables")

            # Register routes after database initialization
            from routes import register_routes
            register_routes(app)
            logger.info("Registered routes")

            # Register Google Drive blueprint
            from google_drive import google_drive
            app.register_blueprint(google_drive)
            logger.info("Registered Google Drive blueprint")

        logger.info("Application setup completed successfully")
        return app

    except Exception as e:
        logger.error(f"Failed to create app: {str(e)}", exc_info=True)
        raise

# Create the application instance
try:
    app = create_app()
except Exception as e:
    logger.error(f"Failed to create application instance: {str(e)}", exc_info=True)
    raise

if __name__ == '__main__':
    try:
        port = int(os.environ.get('PORT', 5000))
        logger.info(f"Starting Flask server on port {port}...")
        app.run(host='0.0.0.0', port=port, debug=True)
    except Exception as e:
        logger.error(f"Failed to start app: {str(e)}", exc_info=True)
        raise