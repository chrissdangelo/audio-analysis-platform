import logging
from flask_sqlalchemy import SQLAlchemy

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize SQLAlchemy without binding to app
db = SQLAlchemy()

def init_db(app):
    """Initialize the SQLAlchemy app."""
    try:
        db.init_app(app)
        with app.app_context():
            # Import models here to avoid circular imports
            from models import AudioAnalysis  # noqa: F401
            db.create_all()
            logger.info("Database initialization completed successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise