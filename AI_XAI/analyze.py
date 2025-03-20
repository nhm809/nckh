from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import shap
import lime
import lime.lime_tabular
import orjson
from flask_cors import CORS  # Thêm dòng này
import traceback
import sys


sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app)  # Kích hoạt CORS


# Dữ liệu mẫu môn học
courses = {
    'Math': {'credits': 3, 'difficulty': 0.8},
    'Reading': {'credits': 3, 'difficulty': 0.6},
    'Writing': {'credits': 3, 'difficulty': 0.7},
    'Biology': {'credits': 3, 'difficulty': 0.5},
    "Physics": {"credits": 4, "difficulty": 0.9},
    "Chemistry": {"credits": 4, "difficulty": 0.7},
    "History": {"credits": 2, "difficulty": 0.4},
    "Computer Science": {"credits": 5, "difficulty": 0.9},
    "Economics": {"credits": 3, "difficulty": 0.6},
    "Psychology": {"credits": 3, "difficulty": 0.5},
    "Philosophy": {"credits": 3, "difficulty": 0.6},
    "Music": {"credits": 2, "difficulty": 0.3},
    "Art": {"credits": 2, "difficulty": 0.4},
    "Environmental Science": {"credits": 3, "difficulty": 0.6},
    "Business": {"credits": 3, "difficulty": 0.7},
    "Statistics": {"credits": 4, "difficulty": 0.8},
    "Engineering": {"credits": 5, "difficulty": 0.9},
    "Medicine": {"credits": 6, "difficulty": 1.0},
    "Law": {"credits": 5, "difficulty": 0.9},
    "Sociology": {"credits": 3, "difficulty": 0.5},
    "Geography": {"credits": 3, "difficulty": 0.5},
    "Astronomy": {"credits": 4, "difficulty": 0.8},
    "Linguistics": {"credits": 3, "difficulty": 0.6},
    "Political Science": {"credits": 3, "difficulty": 0.7}
}

# Hàm dự đoán xác suất cụm cho LIME
def predict_probabilities(model, X):
    if model is None:
        return np.array([[0.5, 0.5]])  # Tránh lỗi khi model chưa được khởi tạo
    clusters = model.predict(X)
    probs = np.zeros((X.shape[0], model.n_clusters))
    for i, cluster in enumerate(clusters):
        probs[i, cluster] = 1  # Xác suất 100% thuộc về cụm đó
    return probs

# Hàm phân tích điểm số và đưa ra khuyến nghị
def recommend_courses(grades_df, grades):
    recommendations = [subject for subject, score in grades.items() if score < 7]

    if not recommendations:
        available_courses = [c for c in courses.keys() if c not in grades.keys()]
        average_score = sum(grades.values()) / len(grades)  # Tính điểm trung bình
        recommendations = sorted(
            available_courses,
            key=lambda x: abs(courses[x]["difficulty"] - average_score)  # Sắp xếp theo độ chênh lệch
        )[:2]  # Chọn 2 môn học có độ khó gần nhất


    # Chỉ sử dụng KMeans nếu có nhiều hơn 1 sinh viên
    kmeans_model = None
    if grades_df.shape[0] > 1:
        n_clusters = min(2, len(grades_df))
        kmeans_model = KMeans(n_clusters=n_clusters, random_state=0, n_init=3).fit(grades_df)

    return recommendations, kmeans_model

# Hàm giải thích bằng SHAP và LIME
def explain_recommendations(grades_df, recommendations, kmeans_model, grades, use_shap=True, use_lime=True):
    explanations = []
    shap_explanation = []
    lime_explanation = []

    for rec in recommendations:
        if rec in grades:
            explanations.append(f"{rec} được đề xuất vì điểm số của bạn là {grades[rec]}, thấp hơn ngưỡng yêu cầu (7).")
        else:
            explanations.append(f"{rec} được đề xuất vì đây là môn học mới, có độ khó {courses[rec]['difficulty']} phù hợp với bạn.")

    # Chỉ sử dụng SHAP và LIME nếu có mô hình KMeans và được yêu cầu
    if kmeans_model is not None and (use_shap or use_lime) and grades_df.shape[0] > 1:
        feature_names = list(grades_df.columns)
        X = grades_df.values

        # SHAP
        if use_shap:
            background = grades_df.sample(n=1, random_state=42).values
            explainer_shap = shap.KernelExplainer(kmeans_model.predict, background)
            shap_values = explainer_shap.shap_values(X)

            for i, feature in enumerate(feature_names):
                shap_value = shap_values[0][i]
                if shap_value > 0:
                    shap_explanation.append(f"{feature} (điểm số: {grades[feature]}) có ảnh hưởng lớn (SHAP value: {shap_value:.2f})")

        # LIME
        if use_lime:
            explainer_lime = lime.lime_tabular.LimeTabularExplainer(
                training_data=X,
                feature_names=feature_names,
                mode='classification',
                random_state=0
            )
            lime_exp = explainer_lime.explain_instance(X[0], lambda x: predict_probabilities(kmeans_model, x), num_features=2)
            lime_explanation = lime_exp.as_list()

    return explanations, shap_explanation, lime_explanation

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        print("Nhận dữ liệu từ frontend:", data)

        students = data.get('students')  # Danh sách sinh viên
        if not students:
            return jsonify({"error": "Dữ liệu không hợp lệ"}), 400

        # Tạo grades_df chứa dữ liệu của tất cả sinh viên
        grades_data = []
        for student in students:
            student_id = student.get('studentID')
            grades = student.get('grades')

            if not student_id or not grades:
                continue  # Bỏ qua nếu thiếu dữ liệu

            grades_data.append(list(grades.values()))

        grades_df = pd.DataFrame(grades_data, columns=list(students[0]['grades'].keys()))

        # Gọi hàm recommend_courses và explain_recommendations
        results = []
        for student in students:
            student_id = student.get('studentID')
            grades = student.get('grades')

            if not student_id or not grades:
                continue  # Bỏ qua nếu thiếu dữ liệu

            recommendations, kmeans_model = recommend_courses(grades_df, grades)
            explanations, shap_explanation, lime_explanation = explain_recommendations(grades_df, recommendations, kmeans_model, grades)

            results.append({
                'studentID': student_id,
                'recommendedCourses': recommendations,
                'explanations': explanations,
                'shapExplanation': shap_explanation,
                'limeExplanation': [str(exp) for exp in lime_explanation]
            })

        print("Phản hồi:", results)
        return jsonify({"students": results})

    except Exception as e:
        print("Lỗi backend:", e)
        print(traceback.format_exc())  # In chi tiết lỗi
        return jsonify({"error": "Lỗi server", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)