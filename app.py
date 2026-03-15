from flask import Flask, render_template, request, jsonify
import datetime
from ai_agent import HumanaAI

app = Flask(__name__)
agent = HumanaAI()

@app.route('/')
def index():
    return render_template('index.html', 
                             title="Generational Wellness - Humana Care",
                             year=datetime.datetime.now().year)

@app.route('/activities')
def activities():
    return render_template('activities.html',
                             title="Activities - Generational Wellness",
                             year=datetime.datetime.now().year)

@app.route('/physical-health')
def physical_health():
    return render_template('physical_health.html',
                             title="Physical Health - Generational Wellness",
                             year=datetime.datetime.now().year)

@app.route('/mental-health')
def mental_health():
    return render_template('mental_health.html',
                             title="Mental Health - Generational Wellness",
                             year=datetime.datetime.now().year)

@app.route('/social-connection')
def social_connection():
    return render_template('social_connection.html',
                             title="Social Connection - Generational Wellness",
                             year=datetime.datetime.now().year)

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "No message provided"}), 400
    
    user_message = data['message']
    response_text = agent.get_response(user_message)
    
    return jsonify({"response": response_text})

if __name__ == '__main__':

    app.run(host='0.0.0.0', port=3000, debug=True)
