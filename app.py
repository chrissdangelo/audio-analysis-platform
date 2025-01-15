import os
import logging
from flask import Flask
from flask_migrate import Migrate
from database import db, init_db
from flask_cors import CORS

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

        # Configure Flask app for public access
        app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"

        # Disable all authentication and security restrictions for public access
        app.config['LOGIN_DISABLED'] = True
        app.config['SESSION_COOKIE_SECURE'] = False
        app.config['SESSION_PROTECTION'] = None
        app.config['PUBLIC'] = True

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
        app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500MB limit
        app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
        logger.info("Configured Flask application settings")

        # Ensure upload directory exists
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        logger.info(f"Created upload directory at {app.config['UPLOAD_FOLDER']}")

        # Enable CORS after basic configuration
        CORS(app, resources={r"/*": {"origins": "*"}})
        logger.info("CORS configuration enabled")

        # Initialize database
        logger.info("Initializing database...")
        init_db(app)  # Initialize database first
        migrate = Migrate(app, db)  # Then set up migrations
        logger.info("Database initialization completed")

        # Register routes and blueprints
        with app.app_context():
            try:
                from routes import register_routes
                register_routes(app)
                logger.info("Routes registered successfully")
            except Exception as e:
                logger.error(f"Failed to register routes: {str(e)}", exc_info=True)
                raise

            try:
                from google_drive import google_drive
                app.register_blueprint(google_drive)
                logger.info("Google Drive blueprint registered")
            except Exception as e:
                logger.warning(f"Failed to register Google Drive blueprint: {str(e)}", exc_info=True)

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
        port = int(os.environ.get('PORT', 3000))
        logger.info(f"Starting Flask server on port {port}...")
        app.run(host='0.0.0.0', port=port, debug=False)
    except Exception as e:
        logger.error(f"Failed to start app: {str(e)}", exc_info=True)
        raise