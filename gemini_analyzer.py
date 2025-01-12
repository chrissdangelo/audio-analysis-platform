import os
import logging
import google.generativeai as genai
import json
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class GeminiAnalyzer:
    def __init__(self):
        """Initialize GeminiAnalyzer with API configuration"""
        try:
            # Verify API key is set
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable is not set")

            genai.configure(api_key=api_key)
            logger.info("Configured Gemini API with provided key")

            # Create the model with specific configuration
            self.generation_config = {
                "temperature": 0.2,  # Lower temperature for more consistent output
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,
                "response_mime_type": "text/plain",
            }

            # Initialize the model with specific system instruction
            self.model = genai.GenerativeModel(
                model_name="gemini-2.0-flash-exp",
                generation_config=self.generation_config,
                system_instruction=(
                    "You are an expert audio content analyzer specializing in children's content. "
                    "Your task is to analyze audio files and provide detailed, accurate metadata "
                    "including emotional and tonal analysis."
                )
            )
            logger.info("Initialized Gemini model")

            # Initialize chat history
            self.chat = self.model.start_chat(history=[])
            logger.info("Started new chat session")

        except Exception as e:
            logger.error(f"Failed to initialize GeminiAnalyzer: {str(e)}")
            raise
    def _clean_list_string(self, value_str: str) -> list:
        """Clean and parse a string into a list, handling various formats."""
        if not value_str:
            return []

        logger.debug(f"Raw input string to clean: {value_str}")

        try:
            # If it's already a list, return it
            if isinstance(value_str, list):
                return value_str

            # Try parsing as JSON first
            try:
                parsed = json.loads(value_str)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass

            # Handle string formatting
            # Remove common list-like characters and split
            cleaned_str = value_str.strip('[](){}').replace('"', '').replace("'", "")
            items = [item.strip() for item in cleaned_str.split(',')]

            # Remove empty items and duplicates while preserving order
            cleaned = list(dict.fromkeys(item for item in items if item))
            logger.debug(f"Cleaned list: {cleaned}")
            return cleaned

        except Exception as e:
            logger.error(f"Error cleaning list string: {str(e)}")
            logger.error(f"Problematic value: {value_str}")
            return []

    def upload_to_gemini(self, file_path: str, mime_type: str = None) -> Dict[str, Any]:
        """Upload and analyze an audio file using Gemini"""
        try:
            logger.info(f"Starting analysis of file: {file_path}")

            # Verify file exists and has content
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            if os.path.getsize(file_path) == 0:
                raise ValueError("File is empty")

            logger.info("Uploading file to Gemini")
            file = genai.upload_file(file_path, mime_type=mime_type)
            logger.info(f"Successfully uploaded file '{file.display_name}' as: {file.uri}")

            prompt = (
                "Analyze this audio file and provide detailed information in these categories:\n"
                "1. Format: Is this narrated (single narrator) or radio play (multiple actors)?\n"
                "2. Narration: Is there a narrator? (Yes/No)\n"
                "3. Underscore: Is there background music? (Yes/No)\n"
                "4. Sound Effects: Are there sound effects? (Yes/No)\n"
                "5. Songs: Total number of complete songs\n"
                "6. Characters Mentioned: List ALL character names (comma-separated)\n"
                "7. Speaking Characters: List only characters with speaking lines (comma-separated)\n"
                "8. Environments: List physical locations only (comma-separated, e.g. house, forest)\n"
                "9. Themes: List abstract concepts only (comma-separated, e.g. friendship, bravery)\n"
                "10. Duration: Total length in HH:MM:SS format\n"
                "11. Emotions: Rate each emotion (joy, sadness, anger, fear, surprise) from 0.0 to 1.0\n"
                "12. Tone Analysis: Describe the overall tone (formal, informal, playful, serious, etc)\n"
                "13. Dominant Emotion: Which emotion is most prevalent?\n"
                "14. Confidence: Rate analysis confidence from 0.0 to 1.0\n\n"
                "Format your response with labels:\n"
                "Format: [answer]\n"
                "Narration: [yes/no]\n"
                "Underscore: [yes/no]\n"
                "Sound Effects: [yes/no]\n"
                "Songs Count: [number]\n"
                "Characters Mentioned: [comma-separated list]\n"
                "Speaking Characters: [comma-separated list]\n"
                "Environments: [comma-separated list]\n"
                "Themes: [comma-separated list]\n"
                "Duration: [HH:MM:SS]\n"
                "Emotions: {'joy': [0-1], 'sadness': [0-1], 'anger': [0-1], 'fear': [0-1], 'surprise': [0-1]}\n"
                "Tone Analysis: [description]\n"
                "Dominant Emotion: [emotion]\n"
                "Confidence: [0-1]\n"
            )

            logger.info("Sending analysis request to Gemini")
            response = self.chat.send_message([file, prompt])

            # Log the raw response
            logger.info("Received response from Gemini")
            logger.debug(f"Raw response:\n{response.text}")

            # Process the response
            analysis = self._parse_gemini_response(response.text)
            return analysis

        except Exception as e:
            logger.error(f"Error in upload_to_gemini: {str(e)}")
            raise ValueError(f"Error analyzing audio content: {str(e)}")

    def _parse_gemini_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini's response into our standard format"""
        try:
            logger.info("Starting to parse Gemini response")

            # Initialize default result with emotion-related fields
            result = {
                'format': 'narrated episode',
                'has_narration': False,
                'has_underscore': False,
                'has_sound_effects': False,
                'songs_count': 0,
                'characters_mentioned': [],
                'speaking_characters': [],
                'environments': [],
                'themes': [],
                'duration': '00:00:00',
                'emotion_scores': {
                    'joy': 0.0,
                    'sadness': 0.0,
                    'anger': 0.0,
                    'fear': 0.0,
                    'surprise': 0.0
                },
                'tone_analysis': {},
                'dominant_emotion': None,
                'confidence_score': 0.0
            }

            # Parse response line by line
            lines = response_text.split('\n')
            logger.debug(f"Found {len(lines)} lines in response")

            for line in lines:
                line = line.strip()
                if not line or ':' not in line:
                    continue

                logger.debug(f"Processing line: {line}")

                # Split line into label and value
                label, value = [part.strip() for part in line.split(':', 1)]
                label = label.lower()

                logger.debug(f"Parsed label: '{label}', value: '{value}'")

                if 'format' in label:
                    result['format'] = 'narrated episode' if 'narrated' in value.lower() else 'radio play'
                elif 'narration' in label:
                    result['has_narration'] = 'yes' in value.lower()
                elif 'underscore' in label or 'background music' in label:
                    result['has_underscore'] = 'yes' in value.lower()
                elif 'sound effects' in label:
                    result['has_sound_effects'] = 'yes' in value.lower()
                elif 'songs' in label and 'count' in label:
                    try:
                        result['songs_count'] = int(''.join(filter(str.isdigit, value))) if any(c.isdigit() for c in value) else 0
                    except ValueError:
                        result['songs_count'] = 0
                elif 'characters mentioned' in label:
                    result['characters_mentioned'] = self._clean_list_string(value)
                elif 'speaking characters' in label:
                    result['speaking_characters'] = self._clean_list_string(value)
                elif 'environments' in label:
                    result['environments'] = self._clean_list_string(value)
                elif 'themes' in label:
                    result['themes'] = self._clean_list_string(value)
                elif 'duration' in label:
                    time_parts = [part for part in value.split() if ':' in part]
                    if time_parts:
                        result['duration'] = time_parts[0]
                elif 'emotions' in label:
                    try:
                        emotions = json.loads(value.replace("'", '"'))
                        result['emotion_scores'] = {
                            k: float(v) for k, v in emotions.items()
                        }
                    except (json.JSONDecodeError, ValueError):
                        logger.warning(f"Could not parse emotion scores: {value}")
                elif 'tone analysis' in label:
                    result['tone_analysis'] = {'tone': value}
                elif 'dominant emotion' in label:
                    result['dominant_emotion'] = value.strip().lower()
                elif 'confidence' in label:
                    try:
                        result['confidence_score'] = float(value)
                    except ValueError:
                        result['confidence_score'] = 0.0

            logger.info("Finished parsing response")
            logger.debug(f"Final parsed result: {result}")
            return result

        except Exception as e:
            logger.error(f"Error parsing Gemini response: {str(e)}")
            raise ValueError(f"Error parsing analysis results: {str(e)}")

    def cleanup(self):
        """Clean up any resources"""
        try:
            self.chat = self.model.start_chat(history=[])
            logger.info("Reset chat history")
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")

    def generate_summary(self, analysis_dict: Dict[str, Any]) -> Dict[str, str]:
        """Generate a summary for an analysis using Gemini AI"""
        try:
            logger.info(f"Generating summary for analysis")

            # Construct a descriptive prompt
            prompt = (
                "Generate a concise summary of this audio content analysis. Here are the key points:\n"
                f"Format: {analysis_dict.get('format', 'unknown')}\n"
                f"Duration: {analysis_dict.get('duration', '00:00:00')}\n"
                f"Characters: {', '.join(analysis_dict.get('characters_mentioned', []))}\n"
                f"Environments: {', '.join(analysis_dict.get('environments', []))}\n"
                f"Themes: {', '.join(analysis_dict.get('themes', []))}\n"
                f"Dominant Emotion: {analysis_dict.get('dominant_emotion', 'neutral')}\n\n"
                "Please provide a natural, flowing summary that captures the essence of this content.\n"
                "Format your response as: Summary: [your summary here]"
            )

            logger.info("Sending summary request to Gemini")
            response = self.chat.send_message(prompt)
            logger.debug(f"Raw response:\n{response.text}")

            # Extract summary from response
            summary_text = response.text
            if 'Summary:' in summary_text:
                summary_text = summary_text.split('Summary:', 1)[1].strip()

            return {'summary': summary_text}

        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            raise ValueError(f"Error generating summary: {str(e)}")