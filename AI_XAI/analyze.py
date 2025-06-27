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
from functools import lru_cache
import re

sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app)

rf_model = None

@lru_cache(maxsize=1)
def load_courses():
    courses_df = pd.read_csv("../DataProcessor/coursesData.csv")
    return {
        row['Course']: {
            'credits': row['Credits'],
            'difficulty': row['Difficulty'],
            'category': row.get('Category', 'General')
        }
        for _, row in courses_df.iterrows()
    }


def get_course_data():
    return load_courses()


courses = load_courses()

# Configuration
MAX_FEATURES_FOR_EXPLANATION = 5
MIN_STUDENTS_FOR_MODEL = 2
MAX_RECOMMENDATIONS = 3
SHAP_THRESHOLD = 0


def train_rf_classifier(X, clusters):
    global rf_model
    rf_model = RandomForestClassifier(n_estimators=50, random_state=42)
    rf_model.fit(X, clusters)


def predict_probabilities(model, X):
    global rf_model

    # Nếu chưa có model phân loại, huấn luyện dựa vào cụm của KMeans
    if rf_model is None:
        clusters = model.predict(X if isinstance(X, np.ndarray) else X.values)
        train_rf_classifier(X if isinstance(X, np.ndarray) else X.values, clusters)

    return rf_model.predict_proba(X if isinstance(X, np.ndarray) else X.values)


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
        return categorized['weak'][:2], "Focus on improving weak subjects"

    if categorized['average']:
        return categorized['average'][:1], "It is recommended to review average subjects"

    if categorized['strong']:
        best_subject = max(grades.items(), key=lambda x: x[1])[0]
        advanced_courses = get_advanced_courses(best_subject)
        if advanced_courses:
            return advanced_courses[:MAX_RECOMMENDATIONS], f"Based on the performance in {best_subject}, advanced courses are recommended"

    
    return get_level_based_recommendations(grades), "Recommend courses that match the student's level"

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
                print("Creating a temporary KMeans model...")
                temp_model = KMeans(n_clusters=min(2, len(grades_df)), random_state=42)
                temp_model.fit(grades_df)
                shap_explanation = explain_with_shap(
                    grades_df,
                    temp_model,
                    {'studentID': grades_df.index[0], 'grades': grades}
                )
            else:
                shap_explanation = explain_with_shap(
                    grades_df,
                    kmeans_model,
                    {'studentID': grades_df.index[0], 'grades': grades}
                )
        except Exception as e:
            print(f"SHAP error: {str(e)}")
        
        try:
            lime_explanation = explain_with_lime(
                grades_df,
                kmeans_model or temp_model,
                {'studentID': grades_df.index[0], 'grades': grades}
            )
        except Exception as e:
            print(f"LIME error: {str(e)}")

    return explanations, shap_explanation, lime_explanation



def generate_explanations(recommendations, grades):
    explanations = []
    avg_score = np.mean(list(grades.values())) if grades else 0

    for course in recommendations:
        if course in grades:
            score = grades[course]
            if score < 5:
                explanations.append(f"{course} (score: {score}) needs urgent improvement (below 5)")
            elif 5 <= score < 8:
                explanations.append(f"{course} (score: {score}) should be reviewed (below 8)")
            else:
                advanced_courses = get_advanced_courses(course)
                if advanced_courses:
                    explanations.append(
                        f"{course} (score: {score}) is excellent! Recommended follow-up courses: {', '.join(advanced_courses)}"
                    )
                else:
                    explanations.append(f"{course} (score: {score}) meets the requirements (8 or above)")
        elif course in courses:  # ✅ CHỈ TRUY CẬP nếu course có trong từ điển
            diff = courses[course]["difficulty"]
            cred = courses[course]["credits"]
            diff_type = (
                "somewhat harder than average" if avg_score / 10 - diff <= 0.2 else "easier"
            ) if diff <= avg_score / 10 else "harder"

            explanations.append(
                f"{course} matches the student's level (difficulty: {diff:.2f}, credits: {cred}) - Assessment: {diff_type} than average"
            )
        else:
            explanations.append(
                f"{course} is a recommended course, but detailed information is not available in the dataset."
            )

    return explanations


# Hàm phụ trợ để lấy khóa học nâng cao 
def get_advanced_courses(course):
    advanced_mapping = {
        "Math": ["Advanced Mathematics", "Calculus"],
        "Basic Physics": ["Advanced Physics", "Quantum Mechanics"],
    }
    return advanced_mapping.get(course, [])



def explain_with_shap(grades_df, model, student_data):
    try:
        # Filter features with sufficient variance to remove noise
        variances = grades_df.var()
        valid_features = variances[variances > 0].index.tolist()

        if not valid_features or len(grades_df) < 2:
            return []

        X = grades_df[valid_features]

        # Use RandomForest instead of GradientBoosting for stability
        rf = RandomForestClassifier(n_estimators=50, random_state=42)
        clusters = model.predict(X)
        rf.fit(X, clusters)

        # Efficient SHAP calculation
        explainer = shap.TreeExplainer(rf)
        shap_values = explainer.shap_values(X)

        # Handle multi-class output
        if isinstance(shap_values, list):
            shap_values = np.mean(shap_values, axis=0)

        student_idx = grades_df.index.get_loc(student_data['studentID'])

        return [
            {
                'feature': feature,
                'score': student_data['grades'].get(feature, 'N/A'),
                'impact': 'positive' if val > 0 else 'negative',
                'value': float(val),
                'abs_value': abs(val)
            }
            for i, feature in enumerate(valid_features)
            if (val := shap_values[student_idx, i]) and abs(val) > SHAP_THRESHOLD
        ][:MAX_FEATURES_FOR_EXPLANATION]  # Limit number of features

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


##Chuẩn hóa đầu ra    
def parse_shap_results(shap_explanation):
    results = {}
    for item in shap_explanation:
        feature = item['feature']
        shap_val = item['value']
        results[feature] = {
            "subject": feature,
            "shap_value": round(shap_val, 3),
            "impact": (
                "High" if abs(shap_val) > 0.2 else
                "Low" if shap_val != 0 else
                "None"
            )
        }
    return results

    
def parse_lime_results(lime_explanation):
    results = {}
    for exp in lime_explanation:
        try:
            feature_str, weight_str = exp.strip("()").split(",")
            # Dùng regex để bắt tên subject
            match = re.search(r"(Math|Reading|Writing)", feature_str)
            feature = match.group(0) if match else feature_str.strip()
            weight = float(weight_str)
            results[feature] = {
                "subject": feature,
                "lime_weight": round(weight, 3)
            }
        except Exception as e:
            print(f"LIME parse error: {e}")
            continue
    return results


def merge_shap_lime(shap_dict, lime_dict):
    combined = {}
    for subj in set(list(shap_dict.keys()) + list(lime_dict.keys())):
        combined[subj] = {
            "subject": subj,
            "shap_value": shap_dict.get(subj, {}).get("shap_value", 0.0),
            "lime_weight": lime_dict.get(subj, {}).get("lime_weight", 0.0),
            "impact": shap_dict.get(subj, {}).get("impact", "Unknown")
        }
    return list(combined.values())

    

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
            student_id = student.get('studentID')
            grades = student.get('grades')

            if not student_id or not grades:
                continue

            grades_data.append(list(grades.values()))
            student_ids.append(student_id)

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
                train_rf_classifier(grades_df.values, kmeans_model.labels_)
            except Exception as e:
                print(f"KMeans failed: {str(e)}")
                use_ml = False
        
        for student in students:
            student_id = student.get('studentID')
            grades = student.get('grades')

            if not student_id or not grades:
                continue

            # ✅ Di chuyển score_table vào đây để mỗi sinh viên có bảng điểm riêng
            score_table = [{
                "subject": subject,
                "score": float(score),
                "evaluation": (
                    "Bad" if score < 5 else
                    "Average" if score < 8 else
                    "Good"
                )
            } for subject, score in grades.items()]

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
            
            shap_dict = parse_shap_results(shap_explanation)
            lime_dict = parse_lime_results(lime_explanation)
            shap_lime_summary = merge_shap_lime(shap_dict, lime_dict)

            result = {
                "studentID": str(student_id),
                "scores": score_table,
                "recommendedCourses": [str(course) for course in recommendations],
                "explanations": explanations,
                "shap_lime_summary": shap_lime_summary
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
    app.run(debug=True, port=5000)


