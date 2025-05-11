from flask import Flask, request, jsonify, session
from flask_cors import CORS
import database as db
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)
app.secret_key = 'your-secret-key'  # Change this in production

# Initialize database
db.init_db()

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    if db.add_user(email, password):
        return jsonify({'message': 'User registered successfully'}), 201
    else:
        return jsonify({'error': 'Email already exists'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    user_id = db.verify_user(email, password)
    if user_id:
        session['user_id'] = user_id
        return jsonify({'message': 'Login successful'}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/start-session', methods=['POST'])
def start_session():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    session_id = db.start_session(session['user_id'])
    session['current_session_id'] = session_id
    return jsonify({'session_id': session_id}), 201

@app.route('/api/end-session', methods=['POST'])
def end_session():
    if 'user_id' not in session or 'current_session_id' not in session:
        return jsonify({'error': 'Not authenticated or no active session'}), 401
    
    db.end_session(session['current_session_id'])
    session.pop('current_session_id', None)
    return jsonify({'message': 'Session ended'}), 200

@app.route('/api/statistics', methods=['POST'])
def add_statistics():
    if 'user_id' not in session or 'current_session_id' not in session:
        return jsonify({'error': 'Not authenticated or no active session'}), 401
    
    data = request.json
    db.add_statistics(
        session['current_session_id'],
        data.get('blink_rate'),
        data.get('avg_distance'),
        data.get('staring_incidents')
    )
    return jsonify({'message': 'Statistics recorded'}), 200

@app.route('/api/user-stats', methods=['GET'])
def get_user_stats():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    days = request.args.get('days', default=30, type=int)
    stats = db.get_user_statistics(session['user_id'], days)
    return jsonify(stats), 200

@app.route('/api/user-summary', methods=['GET'])
def get_user_summary():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    summary = db.get_user_summary(session['user_id'])
    return jsonify(summary), 200

if __name__ == '__main__':
    app.run(debug=True) 