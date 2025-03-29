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

from models.student_model import *
from models.course_model import *
from config import *

sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app)

courses = load_courses()

def predict_probabilities(model, X):
    if model is None:
        return np.array([[0.5, 0.5]])
    clusters = model.predict(X)
    probs = np.zeros((X.shape[0], model.n_clusters))
    for i, cluster in enumerate(clusters):
        probs[i, cluster] = 1
    return probs

def recommend_courses(grades_df, grades):
    # Phân loại môn học với ngưỡng rõ ràng
    score_thresholds = {
        'weak': (0, 5),
        'average': (5, 8),
        'strong': (8, 10)
    }
    
    categorized = {
        'weak': [subj for subj, score in grades.items() if score < score_thresholds['weak'][1]],
        'average': [subj for subj, score in grades.items() 
                   if score_thresholds['average'][0] <= score < score_thresholds['average'][1]],
        'strong': [subj for subj, score in grades.items() 
                  if score >= score_thresholds['strong'][0]]
    }
    
    if categorized['weak']:
        return categorized['weak'][:2], "Cần tập trung cải thiện các môn yếu"
    
    if categorized['average']:
        return categorized['average'][:1], "Nên ôn tập các môn trung bình"
    
    if categorized['strong']:
        best_subject = max(grades.items(), key=lambda x: x[1])[0]
        advanced_courses = get_advanced_courses(best_subject)
        if advanced_courses:
            return advanced_courses[:MAX_RECOMMENDATIONS], f"Dựa trên thành tích môn {best_subject}, gợi ý môn nâng cao"
    
    return get_level_based_recommendations(grades), "Gợi ý môn phù hợp trình độ"

def get_level_based_recommendations(grades):
    avg_score = np.mean(list(grades.values())) if grades else 0
    available_courses = [c for c in courses.keys() if c not in grades.keys()]
    
    return sorted(
        available_courses,
        key=lambda x: (
            abs(courses[x]["difficulty"] - avg_score),
            -courses[x]["credits"],
            courses[x]["difficulty"]
        )
    )[:MAX_RECOMMENDATIONS]

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
            elif 5 <= score < 8:
                explanations.append(f"{course} (điểm: {score}) cần ôn tập (dưới 8 điểm)")
            else:  
                advanced_courses = get_advanced_courses(course)
                if advanced_courses:
                    explanations.append(
                        f"{course} (điểm: {score}) đã xuất sắc! Gợi ý học tiếp: {', '.join(advanced_courses)}"
                    )
                else:
                    explanations.append(f"{course} (điểm: {score}) đã đạt yêu cầu (từ 8 điểm trở lên)")
        else:
            diff = courses[course]["difficulty"]
            cred = courses[course]["credits"]
            diff_type = "dễ hơn" if diff < avg_score/10 else "khó hơn"
            
            diff_type = ("khá khó so với" if avg_score/10 - diff <= 0.2 else "dễ hơn") if diff <= avg_score/10 else "khó hơn"
            
            explanations.append(
                f"{course} phù hợp trình độ (độ khó: {diff:.2f}, tín chỉ: {cred}) - Đánh giá: {diff_type} mức trung bình"
            )
    return explanations

def explain_with_shap(grades_df, model, student_data):
    try:
        # Lọc features có phương sai và loại bỏ nhiễu
        variances = grades_df.var()
        valid_features = variances[variances > 0.01].index.tolist()
        
        if not valid_features or len(grades_df) < 2:
            return []
            
        X = grades_df[valid_features]
        
        # Sử dụng RandomForest thay vì GradientBoosting cho ổn định
        rf = RandomForestClassifier(n_estimators=50, random_state=42)
        clusters = model.predict(X)
        rf.fit(X, clusters)
        
        # Tính SHAP hiệu quả hơn
        explainer = shap.TreeExplainer(rf)
        shap_values = explainer.shap_values(X)
        
        # Xử lý đa lớp
        if isinstance(shap_values, list):
            shap_values = np.mean(shap_values, axis=0)
            
        student_idx = grades_df.index.get_loc(student_data['studentID'])
        
        return [
            {
                'feature': feature,
                'score': student_data['grades'].get(feature, 'N/A'),
                'impact': 'tích cực' if val > 0 else 'tiêu cực',
                'value': float(val),
                'abs_value': abs(val)
            }
            for i, feature in enumerate(valid_features)
            if (val := shap_values[student_idx, i]) and abs(val) > SHAP_THRESHOLD
        ][:MAX_FEATURES_FOR_EXPLANATION]  # Giới hạn số lượng features
        
    except Exception as e:
        print(f"SHAP error: {str(e)}")
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
        
        preparation_result  = prepare_student_data(data)    
        
        if preparation_result is None:
            return jsonify({"error": "Invalid student data"}), 400
            
        students, student_ids, grades_df = preparation_result
                
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

