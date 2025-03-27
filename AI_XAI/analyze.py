from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import shap
from sklearn.ensemble import RandomForestClassifier
import lime
import lime.lime_tabular
from sklearn.preprocessing import StandardScaler
from flask_cors import CORS
import traceback
import sys
import orjson
from sklearn.ensemble import GradientBoostingClassifier

sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app)

# Load courses data
courses_df = pd.read_csv("DataProcessor/coursesData.csv")
courses = {
    row['Course']: {
        'credits': row['Credits'],
        'difficulty': row['Difficulty'],
        'category': row.get('Category', 'General')
    }
    for _, row in courses_df.iterrows()
}

# Configuration
MAX_FEATURES_FOR_EXPLANATION = 5
MIN_STUDENTS_FOR_MODEL = 2
MAX_RECOMMENDATIONS = 3
SHAP_THRESHOLD = 0.01

def predict_probabilities(model, X):
    if model is None:
        return np.array([[0.5, 0.5]])
    clusters = model.predict(X)
    probs = np.zeros((X.shape[0], model.n_clusters))
    for i, cluster in enumerate(clusters):
        probs[i, cluster] = 1
    return probs

def recommend_courses(grades_df, grades):
    # Rule-based recommendations
    weak_courses = [subj for subj, score in grades.items() if score < 5]
    below_avg = [subj for subj, score in grades.items() if 5 <= score < 7]
    
    if weak_courses:
        return weak_courses[:2], None
    elif below_avg:
        return below_avg[:1], None
    else:
        avg_score = np.mean(list(grades.values())) if grades else 0
        available_courses = [c for c in courses.keys() if c not in grades.keys()]
        
        sorted_courses = sorted(
            available_courses,
            key=lambda x: (
                abs(courses[x]["difficulty"] - avg_score),
                -courses[x]["credits"],
                courses[x]["difficulty"]
            )
        )
        return sorted_courses[:MAX_RECOMMENDATIONS], None

def explain_recommendations(grades_df, recommendations, kmeans_model, grades):
    explanations = generate_explanations(recommendations, grades)
    shap_explanation = []
    lime_explanation = []
    
    
    if len(grades_df) >= 2:  
        try:
            if kmeans_model is None:
                print("Tạo model KMeans tạm thời...")
                temp_model = KMeans(n_clusters=min(2, len(grades_df)), random_state=42)
                temp_model.fit(grades_df)
                shap_explanation = explain_with_shap(grades_df, temp_model, 
                                                   {'studentID': grades_df.index[0], 'grades': grades})
            else:
                shap_explanation = explain_with_shap(grades_df, kmeans_model,
                                                   {'studentID': grades_df.index[0], 'grades': grades})
        except Exception as e:
            print(f"Lỗi SHAP: {str(e)}")
        
        try:
            lime_explanation = explain_with_lime(grades_df, kmeans_model or temp_model,
                                               {'studentID': grades_df.index[0], 'grades': grades})
        except Exception as e:
            print(f"Lỗi LIME: {str(e)}")
    
    return explanations, shap_explanation, lime_explanation
def generate_explanations(recommendations, grades):
    explanations = []
    avg_score = np.mean(list(grades.values())) if grades else 0
    
    for course in recommendations:
        if course in grades:
            score = grades[course]
            if score < 5:
                explanations.append(f"{course} (điểm: {score}) cần cải thiện gấp (dưới 5 điểm)")
            else:
                explanations.append(f"{course} (điểm: {score}) cần ôn tập (dưới 7 điểm)")
        else:
            diff = courses[course]["difficulty"]
            cred = courses[course]["credits"]
            diff_type = "dễ hơn" if diff < avg_score else "khó hơn"
            explanations.append(
                f"{course} phù hợp trình độ (độ khó: {diff}, tín chỉ: {cred}) - {diff_type} mức trung bình"
            )
    return explanations


def explain_with_shap(grades_df, model, student_data):
    try:
        print(f"\n=== Bắt đầu tính SHAP cho {student_data['studentID']} ===")
        
        # Kiểm tra số lượng cluster
        unique_clusters = np.unique(model.labels_)
        print(f"Số cluster: {len(unique_clusters)}")
        if len(unique_clusters) < 2:
            print("Cần ít nhất 2 clusters để phân tích SHAP")
            return []

        # Chọn features có phương sai > 0
        variances = grades_df.var()
        valid_features = variances[variances > 0.001].index.tolist()
        print(f"Features hợp lệ: {valid_features}")
        
        if not valid_features:
            print("Không có feature nào có đủ biến động")
            return []
            
        grades_df = grades_df[valid_features].copy()
        
        # Thêm nhiễu nhỏ để đảm bảo đa dạng
        np.random.seed(42)
        noise = pd.DataFrame(np.random.normal(0, 0.01, grades_df.shape), 
                            columns=grades_df.columns,
                            index=grades_df.index)
        X = grades_df + noise
        
        # GradientBoosting
        gb = GradientBoostingClassifier(n_estimators=100, random_state=42)
        gb.fit(X, model.predict(X))
        
        # Tính SHAP values
        explainer = shap.TreeExplainer(gb)
        shap_values = explainer.shap_values(X)
        
        # Xử lý cả trường hợp binary classification
        if isinstance(shap_values, list):
            if len(shap_values) > 1:
                shap_values = shap_values[1]  # Lấy class 1
            else:
                shap_values = shap_values[0]
        
        student_idx = grades_df.index.get_loc(student_data['studentID'])
        explanations = []
        
        for i, feature in enumerate(valid_features):
            val = shap_values[student_idx, i]
            if abs(val) > 0.001:  # Ngưỡng rất thấp để bắt mọi tác động
                explanations.append({
                    'feature': feature,
                    'score': student_data['grades'].get(feature, 'N/A'),
                    'impact': 'tích cực' if val > 0 else 'tiêu cực',
                    'value': float(val)
                })
                print(f"Phát hiện ảnh hưởng: {feature} ({val:.4f})")
        
        return sorted(explanations, key=lambda x: -abs(x['value']))
    
    except Exception as e:
        print(f"!!! LỖI SHAP NGHIÊM TRỌNG: {str(e)}\n{traceback.format_exc()}")
        return []

def explain_with_lime(grades_df, model, student_data):
    try:
        if len(grades_df.columns) > MAX_FEATURES_FOR_EXPLANATION:
            variances = grades_df.var().nlargest(MAX_FEATURES_FOR_EXPLANATION)
            grades_df = grades_df[variances.index]
        
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(grades_df)
        
        explainer = lime.lime_tabular.LimeTabularExplainer(
            training_data=X_scaled,
            feature_names=list(grades_df.columns),
            mode='classification',
            random_state=42
        )
        
        student_idx = grades_df.index.get_loc(student_data['studentID'])
        lime_exp = explainer.explain_instance(
            X_scaled[student_idx],
            lambda x: predict_probabilities(model, x),
            num_features=3
        )
        
        return [str(item) for item in lime_exp.as_list()]
    
    except Exception as e:
        print(f"LIME error: {str(e)}")
        return []

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        students = data.get('students', [])
        
        if not students:
            return jsonify({"error": "Invalid data"}), 400

        # Prepare data
        grades_data = []
        student_ids = []
        
        for student in students:
            if not student.get('studentID') or not student.get('grades'):
                continue
                
            grades_data.append(list(student['grades'].values()))
            student_ids.append(student['studentID'])
        
        if not grades_data:
            return jsonify({"error": "No valid grade data"}), 400
            
        grades_df = pd.DataFrame(grades_data, columns=list(students[0]['grades'].keys()))
        grades_df.index = student_ids
        
        results = []
        use_ml = len(students) >= MIN_STUDENTS_FOR_MODEL
        kmeans_model = None
        
        if use_ml:
            try:
                n_clusters = min(3, len(students))
                kmeans_model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                kmeans_model.fit(grades_df)
                
            except Exception as e:
                print(f"KMeans failed: {str(e)}")
                use_ml = False
        
        for student in students:
            student_id = student.get('studentID')
            grades = student.get('grades')

            if not student_id or not grades:
                continue

            recommendations, _ = recommend_courses(grades_df, grades)
            explanations, shap_explanation, lime_explanation = explain_recommendations(
                grades_df, recommendations, kmeans_model, grades
            )

            # Convert numpy types to native Python types
            def convert_types(obj):
                if isinstance(obj, np.generic):
                    return obj.item()
                elif isinstance(obj, dict):
                    return {k: convert_types(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_types(v) for v in obj]
                return obj

            result = {
                'studentID': str(student_id),
                'recommendedCourses': [str(course) for course in recommendations],
                'explanations': explanations,
                'shapExplanation': [{
                    'feature': str(item['feature']),
                    'score': str(item['score']),
                    'impact': str(item['impact']),
                    'value': float(item['value'])
                } for item in shap_explanation],
                'limeExplanation': [str(exp) for exp in lime_explanation]
            }
            
            results.append(convert_types(result))

        return app.response_class(
            response=orjson.dumps({"students": results}),
            status=200,
            mimetype="application/json"
        )

    except Exception as e:
        print(f"Error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({
            "error": "Server error",
            "details": str(e),
            "trace": traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
    app.run(port=5000)

