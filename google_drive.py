import os
import logging
from functools import wraps
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from flask import Blueprint, session, redirect, url_for, request, jsonify
import json
import io

logger = logging.getLogger(__name__)

google_drive = Blueprint('google_drive', __name__)

# OAuth 2.0 configuration
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CLIENT_CONFIG = {
    "web": {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}

def require_drive_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'google_drive_credentials' not in session:
            return redirect(url_for('google_drive.authorize'))
        return f(*args, **kwargs)
    return decorated_function

@google_drive.route('/drive/authorize')
def authorize():
    try:
        flow = Flow.from_client_config(
            CLIENT_CONFIG,
            scopes=SCOPES,
            redirect_uri=url_for('google_drive.oauth2callback', _external=True)
        )
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        session['google_auth_state'] = state
        return redirect(authorization_url)
    except Exception as e:
        logger.error(f"Error during Google Drive authorization: {str(e)}")
        return jsonify({"error": "Failed to initiate Google Drive authorization"}), 500

@google_drive.route('/drive/oauth2callback')
def oauth2callback():
    try:
        state = session['google_auth_state']
        flow = Flow.from_client_config(
            CLIENT_CONFIG,
            scopes=SCOPES,
            state=state,
            redirect_uri=url_for('google_drive.oauth2callback', _external=True)
        )

        flow.fetch_token(authorization_response=request.url)
        credentials = flow.credentials
        session['google_drive_credentials'] = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        return redirect(url_for('google_drive.list_files'))
    except Exception as e:
        logger.error(f"Error during OAuth callback: {str(e)}")
        return jsonify({"error": "Failed to complete Google Drive authentication"}), 500

@google_drive.route('/drive/files')
@require_drive_auth
def list_files():
    try:
        credentials = Credentials.from_authorized_user_info(
            session['google_drive_credentials'],
            SCOPES
        )
        service = build('drive', 'v3', credentials=credentials)

        # Only list audio files
        query = "mimeType contains 'audio/' and trashed = false"
        results = service.files().list(
            q=query,
            pageSize=10,
            fields="files(id, name, mimeType)"
        ).execute()

        files = results.get('files', [])
        return jsonify({"files": files})
    except Exception as e:
        logger.error(f"Error listing Google Drive files: {str(e)}")
        return jsonify({"error": "Failed to list Google Drive files"}), 500

@google_drive.route('/drive/download/<file_id>')
@require_drive_auth
def download_file(file_id):
    try:
        credentials = Credentials.from_authorized_user_info(
            session['google_drive_credentials'],
            SCOPES
        )
        service = build('drive', 'v3', credentials=credentials)

        # Get file metadata
        file_metadata = service.files().get(fileId=file_id).execute()

        # Download file
        request = service.files().get_media(fileId=file_id)
        file = io.BytesIO()
        downloader = MediaIoBaseDownload(file, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()

        file.seek(0)
        return jsonify({
            "success": True,
            "filename": file_metadata['name'],
            "content": file.read().decode('utf-8')
        })
    except Exception as e:
        logger.error(f"Error downloading file from Google Drive: {str(e)}")
        return jsonify({"error": "Failed to download file from Google Drive"}), 500