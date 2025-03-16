import sys
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import shap
import lime
import lime.lime_tabular
import orjson

# Dữ liệu mẫu môn học
courses = {
    'Math': {'credits': 3, 'difficulty': 0.8},
    'Reading': {'credits': 3, 'difficulty': 0.6},
    'Writing': {'credits': 3, 'difficulty': 0.7},
    'Biology': {'credits': 3, 'difficulty': 0.5},
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
        recommendations = available_courses[:2]

    # Chỉ sử dụng KMeans nếu có nhiều hơn 1 sinh viên
    kmeans_model = None
    if grades_df.shape[0] > 1:
        n_clusters = min(2, len(grades_df))
        kmeans_model = KMeans(n_clusters=n_clusters, random_state=0, n_init=3).fit(grades_df)

    return recommendations, kmeans_model

# Hàm giải thích bằng SHAP và LIME
def explain_recommendations(grades_df, recommendations, kmeans_model, grades):
    explanations = []
    shap_explanation = []
    lime_explanation = []

    for rec in recommendations:
        if rec in grades:
            explanations.append(f"{rec} được đề xuất vì điểm số của bạn là {grades[rec]}, thấp hơn ngưỡng yêu cầu (7).")
        else:
            explanations.append(f"{rec} được đề xuất vì đây là môn học mới, có độ khó {courses[rec]['difficulty']} phù hợp với bạn.")

    # Chỉ sử dụng SHAP và LIME nếu có mô hình KMeans
    if kmeans_model is not None:
        feature_names = list(grades_df.columns)
        X = grades_df.values

        # SHAP
        background = grades_df.sample(n=1, random_state=42).values
        explainer_shap = shap.KernelExplainer(kmeans_model.predict, background)
        shap_values = explainer_shap.shap_values(X)

        for i, feature in enumerate(feature_names):
            shap_value = shap_values[0][i]
            if shap_value > 0:
                shap_explanation.append(f"{feature} (điểm số: {grades[feature]}) có ảnh hưởng lớn (SHAP value: {shap_value:.2f})")

        # LIME
        explainer_lime = lime.lime_tabular.LimeTabularExplainer(
            training_data=X,
            feature_names=feature_names,
            mode='classification',
            random_state=0
        )
        lime_exp = explainer_lime.explain_instance(X[0], lambda x: predict_probabilities(kmeans_model, x), num_features=2)
        lime_explanation = lime_exp.as_list()

    return explanations, shap_explanation, lime_explanation

# Đọc dữ liệu đầu vào từ API (JSON)
try:
    input_data = orjson.loads(sys.argv[1])
    student_id = input_data['studentID']
    grades = input_data['grades']
except (orjson.JSONDecodeError, KeyError) as e:
    print(orjson.dumps({"error": "Dữ liệu đầu vào không hợp lệ", "details": str(e)}))
    sys.exit(1)

# Chuyển dữ liệu điểm số thành DataFrame
grades_df = pd.DataFrame([list(grades.values())], columns=list(grades.keys()))

# Thực hiện phân tích
try:
    recommendations, kmeans_model = recommend_courses(grades_df, grades)
    explanations, shap_explanation, lime_explanation = explain_recommendations(grades_df, recommendations, kmeans_model, grades)

    result = {
        'studentID': student_id,
        'recommendedCourses': recommendations,
        'explanations': explanations,
        'shapExplanation': shap_explanation,
        'limeExplanation': [str(exp) for exp in lime_explanation]
    }

    # In kết quả dưới dạng JSON
    print(orjson.dumps(result, option=orjson.OPT_NON_STR_KEYS).decode("utf-8"))

except Exception as e:
    print(orjson.dumps({"error": "Đã xảy ra lỗi khi xử lý yêu cầu", "details": str(e)}))