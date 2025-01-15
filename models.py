import logging
from datetime import datetime
import secrets
from database import db
import json

class GuestAccess(db.Model):
    __tablename__ = 'guest_access'

    id = db.Column(db.Integer, primary_key=True)
    access_token = db.Column(db.String(64), unique=True, nullable=False)
    access_level = db.Column(db.String(20), default='read-only', nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_accessed = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)

    @staticmethod
    def generate_token():
        """Generate a secure random token for guest access"""
        return secrets.token_urlsafe(32)

    def is_valid(self):
        """Check if the guest access token is still valid"""
        return (self.is_active and 
                self.expires_at > datetime.utcnow())

    def to_dict(self):
        """Convert the guest access object to a dictionary"""
        return {
            'id': self.id,
            'access_token': self.access_token,
            'access_level': self.access_level,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'is_active': self.is_active
        }

class AudioAnalysis(db.Model):
    __tablename__ = 'audio_analyses'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))  # Audio or Video
    format = db.Column(db.String(50))     # Narrated or Radio
    duration = db.Column(db.String(20))    # HH:MM:SS format
    has_narration = db.Column(db.Boolean, default=False)
    has_underscore = db.Column(db.Boolean, default=False)
    has_sound_effects = db.Column(db.Boolean, default=False)
    songs_count = db.Column(db.Integer, default=0)
    environments = db.Column(db.Text)  # Store as JSON string
    characters_mentioned = db.Column(db.Text)  # Store as JSON string
    speaking_characters = db.Column(db.Text)  # Store as JSON string
    themes = db.Column(db.Text)  # Store as JSON string
    transcript = db.Column(db.Text)  # Store audio transcript
    summary = db.Column(db.Text)  # Store episode summary
    # Emotion analysis fields
    emotion_scores = db.Column(db.Text)  # Store as JSON string with scores for each emotion
    dominant_emotion = db.Column(db.String(50))  # Primary detected emotion
    tone_analysis = db.Column(db.Text)  # Store as JSON string with tone characteristics
    confidence_score = db.Column(db.Float)  # Analysis confidence level
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def _parse_list_field(self, value):
        """Parse a field that should contain a list."""
        if not value:
            return []
        try:
            if isinstance(value, list):
                return value
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else [parsed]
        except (json.JSONDecodeError, TypeError):
            return []

    def _parse_json_field(self, value):
        """Parse a field that should contain a JSON object."""
        if not value:
            return {}
        try:
            if isinstance(value, dict):
                return value
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}

    def to_dict(self):
        """Convert model instance to dictionary."""
        try:
            return {
                'id': self.id,
                'title': self.title,
                'filename': self.filename,
                'file_type': self.file_type,
                'format': self.format,
                'duration': self.duration,
                'has_narration': self.has_narration,
                'has_underscore': self.has_underscore,
                'has_sound_effects': self.has_sound_effects,
                'songs_count': self.songs_count,
                'environments': self._parse_list_field(self.environments),
                'characters_mentioned': self._parse_list_field(self.characters_mentioned),
                'speaking_characters': self._parse_list_field(self.speaking_characters),
                'themes': self._parse_list_field(self.themes),
                'summary': self.summary,
                'emotion_scores': self._parse_json_field(self.emotion_scores),
                'dominant_emotion': self.dominant_emotion,
                'tone_analysis': self._parse_json_field(self.tone_analysis),
                'confidence_score': self.confidence_score,
                'created_at': self.created_at.isoformat() if self.created_at else None
            }
        except Exception as e:
            logging.error(f"Error in to_dict: {str(e)}")
            return {
                'id': self.id,
                'title': self.title,
                'filename': self.filename,
                'file_type': self.file_type,
                'format': self.format,
                'duration': self.duration,
                'has_narration': self.has_narration,
                'has_underscore': self.has_underscore,
                'has_sound_effects': self.has_sound_effects,
                'songs_count': self.songs_count,
                'environments': [],
                'characters_mentioned': [],
                'speaking_characters': [],
                'themes': [],
                'summary': '',
                'emotion_scores': {},
                'dominant_emotion': None,
                'tone_analysis': {},
                'confidence_score': None,
                'created_at': self.created_at.isoformat() if self.created_at else None
            }