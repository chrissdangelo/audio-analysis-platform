import os
import logging
from functools import wraps
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from flask import Blueprint, session, redirect, url_for, request, jsonify
from flask_login import login_required, current_user, login_user
from models import User
from database import db
import json
import io

logger = logging.getLogger(__name__)

google_drive = Blueprint('google_drive', __name__)

# OAuth 2.0 configuration
SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']

def get_google_client_config():
    return {
        "web": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [f"https://{os.environ.get('REPL_SLUG')}.{os.environ.get('REPL_OWNER')}.repl.co/oauth2callback"]
        }
    }

@google_drive.route('/authorize')
def authorize():
    try:
        flow = Flow.from_client_config(
            get_google_client_config(),
            scopes=SCOPES,
            redirect_uri=url_for('google_drive.oauth2callback', _external=True)
        )
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        session['state'] = state
        return redirect(authorization_url)
    except Exception as e:
        logger.error(f"Error during Google Drive authorization: {str(e)}")
        return jsonify({"error": "Failed to initiate Google Drive authorization"}), 500

@google_drive.route('/oauth2callback')
def oauth2callback():
    try:
        flow = Flow.from_client_config(
            get_google_client_config(),
            scopes=SCOPES,
            state=session['state'],
            redirect_uri=url_for('google_drive.oauth2callback', _external=True)
        )

        flow.fetch_token(authorization_response=request.url)
        credentials = flow.credentials

        # Get user info
        oauth2_client = build('oauth2', 'v2', credentials=credentials)
        user_info = oauth2_client.userinfo().get().execute()

        # Find or create user
        user = User.query.filter_by(email=user_info['email']).first()
        if not user:
            user = User(
                email=user_info['email'],
                name=user_info.get('name'),
                google_id=user_info['id']
            )
            db.session.add(user)
            db.session.commit()

        login_user(user)

        # Store credentials
        session['google_credentials'] = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }

        return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Error during OAuth callback: {str(e)}")
        return jsonify({"error": "Failed to complete Google authentication"}), 500

@google_drive.route('/drive/files')
@login_required
def list_files():
    try:
        if 'google_credentials' not in session:
            return jsonify({"error": "Authentication required"}), 401

        credentials = Credentials.from_authorized_user_info(
            session['google_credentials'],
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
@login_required
def download_file(file_id):
    try:
        if 'google_credentials' not in session:
            return jsonify({"error": "Authentication required"}), 401

        credentials = Credentials.from_authorized_user_info(
            session['google_credentials'],
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
            "content": file.getvalue().decode('utf-8', errors='ignore')
        })
    except Exception as e:
        logger.error(f"Error downloading file from Google Drive: {str(e)}")
        return jsonify({"error": "Failed to download file from Google Drive"}), 500