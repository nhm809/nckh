import sys
import json
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import shap
import lime
import lime.lime_tabular

# Đọc dữ liệu đầu vào từ API (JSON)
input_data = json.loads(sys.argv[1])
student_id = input_data['studentID']
grades = input_data['grades']  # {'Math': 8, 'Reading': 6, 'Writing': 7}

# Dữ liệu mẫu môn học
courses = {
    'Math': {'credits': 3, 'difficulty': 0.8},
    'Reading': {'credits': 3, 'difficulty': 0.6},
    'Writing': {'credits': 3, 'difficulty': 0.7},
    'Biology': {'credits': 3, 'difficulty': 0.5},
}

# Chuyển dữ liệu điểm số thành DataFrame
grades_df = pd.DataFrame([list(grades.values())], columns=list(grades.keys()))

# Hàm dự đoán xác suất cụm cho LIME
def predict_probabilities(model, X):
    clusters = model.predict(X)
    probs = np.zeros((X.shape[0], model.n_clusters))
    for i, cluster in enumerate(clusters):
        probs[i, cluster] = 1  # Xác suất 100% thuộc về cụm đó
    return probs

# Hàm phân tích điểm số và đưa ra khuyến nghị
def recommend_courses(grades_df):
    kmeans = KMeans(n_clusters=2, random_state=0, n_init=10).fit(grades_df)
    cluster = kmeans.labels_[0]

    recommendations = []
    for subject, score in grades.items():
        if score < 7:
            recommendations.append(subject)

    if not recommendations:
        available_courses = [c for c in courses.keys() if c not in grades.keys()]
        recommendations = available_courses[:2]

    return recommendations, kmeans

# Hàm giải thích bằng SHAP và LIME
def explain_recommendations(grades_df, recommendations, kmeans_model):
    explanations = []
    feature_names = list(grades_df.columns)
    X = grades_df.values

    # SHAP
    background = np.median(X, axis=0).reshape(1, -1)
    explainer_shap = shap.KernelExplainer(kmeans_model.predict, background)
    shap_values = explainer_shap.shap_values(X)

    shap_explanation = []
    for i, feature in enumerate(feature_names):
        shap_value = shap_values[0][i]
        if shap_value > 0:
            shap_explanation.append(f"{feature} (điểm số: {grades[feature]}) có ảnh hưởng lớn đến quyết định (SHAP value: {shap_value:.2f})")

    # LIME
    explainer_lime = lime.lime_tabular.LimeTabularExplainer(
        training_data=X,
        feature_names=feature_names,
        mode='regression',  
        random_state=0
    )
    lime_exp = explainer_lime.explain_instance(X[0], lambda x: predict_probabilities(kmeans_model, x), num_features=3)
    lime_explanation = lime_exp.as_list()

    for rec in recommendations:
        if rec in grades:
            explanations.append(f"{rec} được đề xuất vì điểm số của bạn là {grades[rec]}, thấp hơn ngưỡng yêu cầu (7).")
        else:
            explanations.append(f"{rec} được đề xuất vì đây là môn học mới, có độ khó {courses[rec]['difficulty']} phù hợp với bạn.")

    return explanations, shap_explanation, lime_explanation

# Thực hiện phân tích
recommendations, kmeans_model = recommend_courses(grades_df)
explanations, shap_explanation, lime_explanation = explain_recommendations(grades_df, recommendations, kmeans_model)

# Kết quả trả về
result = {
    'studentID': student_id,
    'recommendedCourses': recommendations,
    'explanations': explanations,
    'shapExplanation': shap_explanation,
    'limeExplanation': [str(exp) for exp in lime_explanation]
}

# In kết quả dưới dạng JSON
print(json.dumps(result))
