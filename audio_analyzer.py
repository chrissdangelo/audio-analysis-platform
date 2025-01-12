import os
import shutil
import logging
import tempfile
import subprocess
import time
from typing import Dict, Any
from openai import OpenAI, RateLimitError
from pydub import AudioSegment
import json

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AudioAnalyzer:
    def __init__(self):
        """Initialize AudioAnalyzer with OpenAI client"""
        try:
            self.temp_dir = tempfile.mkdtemp()
            logger.debug("Created temporary directory at: %s", self.temp_dir)

            # Initialize OpenAI client
            self.client = OpenAI()

            # Verify FFmpeg installation
            try:
                subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
                logger.debug("FFmpeg is available")
            except subprocess.CalledProcessError as e:
                logger.error("FFmpeg not found or not working properly")
                raise ValueError("FFmpeg is required but not available")

        except Exception as e:
            logger.error("Failed to initialize AudioAnalyzer: %s", str(e))
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
            raise

    def _transcribe_with_retry(self, audio_file, max_retries=3):
        """Attempt to transcribe audio with retries"""
        for attempt in range(max_retries):
            try:
                return self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json"
                )
            except RateLimitError as e:
                if attempt == max_retries - 1:
                    raise ValueError("OpenAI API rate limit exceeded. Please try again in a few minutes.") from e
                wait_time = (attempt + 1) * 2  # Exponential backoff
                logger.warning(f"Rate limit hit, waiting {wait_time} seconds before retry")
                time.sleep(wait_time)
            except Exception as e:
                raise ValueError(f"Error transcribing audio: {str(e)}") from e

    def analyze_content(self, file_path: str) -> Dict[str, Any]:
        """Analyze audio content using Whisper and audio processing"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        logger.info(f"Starting analysis of file: {file_path}")
        temp_wav = None

        try:
            # Basic file validation
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                raise ValueError("File is empty")

            if file_size > 500 * 1024 * 1024:  # 500MB limit
                raise ValueError("File size exceeds 500MB limit")

            file_ext = os.path.splitext(file_path)[1].lower()
            if not file_ext:
                raise ValueError("File has no extension")

            valid_extensions = {'.mp3', '.wav', '.mp4', '.avi', '.mov'}
            if file_ext not in valid_extensions:
                raise ValueError(f"Unsupported file format. Supported formats: {', '.join(valid_extensions)}")

            # Convert to WAV for analysis
            temp_wav = os.path.join(self.temp_dir, "temp.wav")
            try:
                # Use FFmpeg for conversion
                convert_cmd = [
                    'ffmpeg', '-i', file_path,
                    '-ac', '1',  # Convert to mono
                    '-ar', '16000',  # Set sample rate for Whisper
                    '-acodec', 'pcm_s16le',  # Use 16-bit PCM codec
                    '-y',  # Overwrite output file if exists
                    temp_wav
                ]
                subprocess.run(convert_cmd, capture_output=True, text=True, check=True)
                logger.debug("File converted to WAV successfully")

                # Get audio duration using pydub
                audio = AudioSegment.from_wav(temp_wav)
                duration = len(audio) / 1000.0  # Convert to seconds

                # Format duration
                hours = int(duration // 3600)
                minutes = int((duration % 3600) // 60)
                seconds = int(duration % 60)
                formatted_duration = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

                # Analyze audio using Whisper with retry logic
                logger.debug("Starting Whisper analysis")
                with open(temp_wav, 'rb') as audio_file:
                    transcription = self._transcribe_with_retry(audio_file)

                # Extract real information from transcription
                segments = transcription.segments
                logger.debug(f"Found {len(segments)} segments in audio")

                # Analyze audio characteristics
                full_text = ' '.join(segment.text for segment in segments)
                logger.debug("Extracted full text from audio")

                # Detect voice characteristics
                multiple_speakers = len([s for s in segments if s.confidence > 0.8]) > 3
                speaking_characters = ["Multiple Speakers"] if multiple_speakers else ["Single Speaker"]

                # Detect music and sound effects
                has_music = '♪' in full_text or '♫' in full_text
                sfx_segments = [s for s in segments if s.end - s.start < 0.5 and s.confidence < 0.5]

                # Analyze audio environment
                avg_confidence = sum(s.confidence for s in segments) / len(segments) if segments else 0
                environments = []
                if avg_confidence > 0.9:
                    environments.append("clear audio environment")
                elif avg_confidence < 0.6:
                    environments.append("noisy environment")

                # Determine format based on content
                has_speech = any(s.confidence > 0.8 for s in segments)
                format_type = "narrated content" if has_speech else "ambient audio"

                result = {
                    'length': duration,
                    'format': format_type,
                    'has_underscore': has_music,
                    'sound_effects_count': len(sfx_segments),
                    'songs_count': sum(1 for s in segments if '♪' in s.text or '♫' in s.text),
                    'characters_mentioned': [],  # Let's keep this empty as it requires NLP
                    'speaking_characters': speaking_characters,
                    'environments': environments,
                    'themes': [],  # Let's keep this empty as it requires semantic analysis
                    'duration': formatted_duration
                }

                logger.info("Analysis completed successfully")
                return result

            except subprocess.CalledProcessError as e:
                logger.error(f"FFmpeg error: {str(e)}")
                raise ValueError("Error converting audio format. Please ensure the file is not corrupted.")
            except Exception as e:
                logger.error(f"Error analyzing audio: {str(e)}")
                raise ValueError(f"Error analyzing audio content: {str(e)}")

        finally:
            if temp_wav and os.path.exists(temp_wav):
                try:
                    os.remove(temp_wav)
                    logger.debug("Cleaned up temporary WAV file")
                except Exception as e:
                    logger.error(f"Error cleaning up temp file: {str(e)}")

    def cleanup(self):
        """Clean up temporary resources"""
        try:
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                logger.debug("Cleaned up temporary directory")
        except Exception as e:
            logger.error(f"Error cleaning up: {str(e)}")

    def __del__(self):
        """Ensure cleanup on destruction"""
        self.cleanup()