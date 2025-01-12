# Audio Analysis Platform

An advanced web-based audio analysis platform that leverages AI and multimedia processing technologies to provide comprehensive audio diagnostics and intelligent insights.

## Core Technologies

- Flask web framework for backend development
- Gemini AI for intelligent content analysis
- MoviePy for advanced audio processing
- Wavesurfer.js for interactive audio visualization
- PostgreSQL with Flask-Migrate for robust data management
- Natural Language Processing (NLP) for audio content extraction

## Features

- Audio file upload and analysis
- Real-time waveform visualization
- Content analysis with Gemini AI
- Interactive dashboard with analytics
- Data visualization with Chart.js
- Theme detection and classification

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
GEMINI_API_KEY=your_key_here
DATABASE_URL=your_postgresql_url
```

3. Initialize database:
```bash
flask db upgrade
```

4. Run the application:
```bash
python app.py
```

## Development

The application is structured as follows:

- `/templates` - HTML templates
- `/static` - JavaScript, CSS, and other static assets
- `/uploads` - Temporary file storage for processing
- `/migrations` - Database migration files

## License

MIT
