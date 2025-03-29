from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import orjson
from services.analysis import analyze_students
from utils.logging import setup_logging

app = Flask(__name__)
CORS(app)
setup_logging(app)

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        if not data or 'students' not in data:
            return jsonify({"error": "Invalid request format"}), 400
            
        students = data['students']
        if not students:
            return jsonify({"error": "Empty student list"}), 400
        
        results = analyze_students(students)
        if results is None:
            return jsonify({"error": "No valid student data"}), 400

        return app.response_class(
            response=orjson.dumps({"students": results}),
            status=200,
            mimetype="application/json"
        )

    except Exception as e:
        app.logger.error(f"Analysis error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({
            "error": "Analysis failed",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)