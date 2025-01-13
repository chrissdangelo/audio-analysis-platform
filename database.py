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
    db.init_app(app)
    with app.app_context():
        import models  # noqa: F401
        db.create_all()
        logger.info("Created database tables")