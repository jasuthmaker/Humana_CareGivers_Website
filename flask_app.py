from flask import Flask, render_template
import datetime

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html', 
                           title="Generational Wellness - Humana Care",
                           year=datetime.datetime.now().year)

if __name__ == '__main__':
    # Standard Flask port is 5000, but for this environment we use 3000
    app.run(host='0.0.0.0', port=3000, debug=True)
