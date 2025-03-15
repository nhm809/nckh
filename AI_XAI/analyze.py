import sys
import json
import pandas as pd
import numpy as np
import shap
import lime
import lime.lime_tabular

# Đọc dữ liệu đầu vào từ API (JSON)
input_data = json.loads(sys.argv[1])
student_id = input_data['studentID']
grades = input_data['grades']  # {'Math': 8, 'Reading': 6, 'Writing': 7}

# Dữ liệu môn học có sẵn
courses = {
    'Math': {'credits': 3, 'difficulty': 0.8},
    'Reading': {'credits': 3, 'difficulty': 0.6},
    'Writing': {'credits': 3, 'difficulty': 0.7},
    'Biology': {'credits': 3, 'difficulty': 0.5},
}

# Chuyển điểm thành DataFrame
grades_df = pd.DataFrame([grades], columns=grades.keys())

# Xây dựng hệ thống gợi ý
def recommend_courses(grades):
    recommendations = []
    
    # Nếu điểm < 7, gợi ý học lại môn đó
    for subject, score in grades.items():
        if score < 7:
            recommendations.append(subject)

    # Nếu không có môn nào cần học lại, gợi ý môn học mới
    if not recommendations:
        available_courses = [c for c in courses.keys() if c not in grades.keys()]
        recommendations = available_courses[:2]  # Chọn 2 môn mới

    return recommendations

# Hàm giải thích bằng SHAP & LIME
def explain_recommendations(grades_df, recommendations):
    explanations = []
    feature_names = list(grades_df.columns)
    X = grades_df.values

    # Mô phỏng model đơn giản dựa trên điểm số
    def simple_model(X):
        return np.array([sum(x) / len(x) for x in X])  # Trung bình điểm số

    # SHAP: Đánh giá ảnh hưởng của từng môn
    explainer_shap = shap.Explainer(simple_model, X)
    shap_values = explainer_shap(X)[0].values

    shap_explanation = []
    for i, feature in enumerate(feature_names):
        shap_value = shap_values[i]
        shap_explanation.append(f"{feature} (điểm: {grades[feature]}) có tác động {shap_value:.2f} đến quyết định.")

    # LIME: Mô hình dự đoán xác suất học môn mới
    explainer_lime = lime.lime_tabular.LimeTabularExplainer(
        training_data=X,
        feature_names=feature_names,
        mode='regression',
        random_state=0
    )
    lime_exp = explainer_lime.explain_instance(X[0], simple_model, num_features=3)
    lime_explanation = lime_exp.as_list()

    # Tạo giải thích cuối cùng
    for rec in recommendations:
        if rec in grades:
            explanations.append(f"Môn {rec} được đề xuất vì điểm của bạn là {grades[rec]}, thấp hơn 7.")
        else:
            explanations.append(f"Môn {rec} được đề xuất vì đây là môn mới, có độ khó {courses[rec]['difficulty']}.")

    return explanations, shap_explanation, lime_explanation

# Thực hiện gợi ý
recommendations = recommend_courses(grades)
explanations, shap_explanation, lime_explanation = explain_recommendations(grades_df, recommendations)

# Kết quả JSON
result = {
    'studentID': student_id,
    'recommendedCourses': recommendations,
    'explanations': explanations,
    'shapExplanation': shap_explanation,
    'limeExplanation': [str(exp) for exp in lime_explanation]
}

# In kết quả dưới dạng JSON
print(json.dumps(result))
