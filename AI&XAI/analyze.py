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
grades = input_data['grades']  # Ví dụ: {'Math': 8, 'Reading': 6, 'Writing': 7}

# Dữ liệu mẫu môn học (có thể lưu trong database)
courses = {
    'Math': {'credits': 3, 'difficulty': 0.8},
    'Reading': {'credits': 3, 'difficulty': 0.6},
    'Writing': {'credits': 3, 'difficulty': 0.7},
    'Biology': {'credits': 3, 'difficulty': 0.5},
}

# Chuyển dữ liệu điểm số thành DataFrame để xử lý
grades_df = pd.DataFrame([list(grades.values())], columns=list(grades.keys()))
<<<<<<< Tabnine <<<<<<<
def recommend_courses(grades_df):#+
    """#+
    Hàm phân tích điểm số của sinh viên và đưa ra khuyến nghị cho các môn học mới.#+
    Sử dụng thuật toán KMeans để phân cụm dữ liệu điểm số thành 2 cụm.#+
    Nếu điểm số của sinh viên dưới 7 trong một môn học, hàm sẽ gợi ý học lại môn đó.#+
    Nếu không có môn nào cần cải thiện, hàm sẽ gợi ý 2 môn học mới.#+
#+
    Parameters:#+
    grades_df (pandas.DataFrame): DataFrame chứa điểm số của sinh viên. Các cột của DataFrame là tên môn học, và các hàng là điểm số của sinh viên.#+
#+
    Returns:#+
    recommendations (list): Danh sách các môn học được gợi ý.#+
    kmeans (sklearn.cluster.KMeans): Đối tượng KMeans đã được huấn luyện để phân cụm dữ liệu điểm số.#+
    """#+
    # Sử dụng KMeans để phân cụm dữ liệu (giả định đơn giản với 2 cụm)#+
    kmeans = KMeans(n_clusters=2, random_state=0).fit(grades_df)#+
    cluster = kmeans.labels_[0]#+
#+
    # Gợi ý môn học dựa trên điểm số thấp (cần cải thiện)#+
    recommendations = []#+
    for subject, score in grades.items():#+
        if score < 7:  # Nếu điểm dưới 7, gợi ý học lại#+
            recommendations.append(subject)#+
#+
    # Nếu không có môn nào cần cải thiện, gợi ý môn mới#+
    if not recommendations:#+
        available_courses = [c for c in courses.keys() if c not in grades.keys()]#+
        recommendations = available_courses[:2]  # Gợi ý 2 môn mới#+
#+
    return recommendations, kmeans#+
>>>>>>> Tabnine >>>>>>># {"conversationId":"87d922b8-a314-4938-9b6b-8843ade05b43","source":"instruct"}
# Hàm phân tích điểm số và đưa ra khuyến nghị (AI)
def recommend_courses(grades_df):
    # Sử dụng KMeans để phân cụm dữ liệu (giả định đơn giản với 2 cụm)
    kmeans = KMeans(n_clusters=2, random_state=0).fit(grades_df)
    cluster = kmeans.labels_[0]

    # Gợi ý môn học dựa trên điểm số thấp (cần cải thiện)
    recommendations = []
    for subject, score in grades.items():
        if score < 7:  # Nếu điểm dưới 7, gợi ý học lại
            recommendations.append(subject)

    # Nếu không có môn nào cần cải thiện, gợi ý môn mới
    if not recommendations:
        available_courses = [c for c in courses.keys() if c not in grades.keys()]
        recommendations = available_courses[:2]  # Gợi ý 2 môn mới

    return recommendations, kmeans

# Hàm giải thích khuyến nghị bằng XAI (SHAP và LIME)
def explain_recommendations(grades_df, recommendations, kmeans_model):
    explanations = []

    # Chuẩn bị dữ liệu cho SHAP và LIME
    feature_names = list(grades_df.columns)
    X = grades_df.values

    # SHAP: Giải thích toàn cục về các yếu tố ảnh hưởng
    explainer_shap = shap.KernelExplainer(kmeans_model.predict, X)
    shap_values = explainer_shap.shap_values(X)
    shap_explanation = []
    for i, feature in enumerate(feature_names):
        shap_value = shap_values[0][i]
        if shap_value > 0:
            shap_explanation.append(f"{feature} (điểm số: {grades[feature]}) có ảnh hưởng lớn đến quyết định (SHAP value: {shap_value:.2f})")

    # LIME: Giải thích cục bộ cho từng khuyến nghị
    explainer_lime = lime.lime_tabular.LimeTabularExplainer(
        training_data=X,
        feature_names=feature_names,
        mode='classification',
        random_state=0
    )
    lime_exp = explainer_lime.explain_instance(X[0], kmeans_model.predict_proba, num_features=3)
    lime_explanation = lime_exp.as_list()

    # Tạo giải thích minh bạch cho từng khuyến nghị
    for rec in recommendations:
        if rec in grades:
            explanations.append(f"{rec} được đề xuất vì điểm số của bạn là {grades[rec]}, thấp hơn ngưỡng yêu cầu (7), và đây là môn học quan trọng cần cải thiện.")
        else:
            explanations.append(f"{rec} được đề xuất vì đây là môn học mới, phù hợp để mở rộng kiến thức và có mức độ khó ({courses[rec]['difficulty']}) phù hợp với năng lực của bạn.")

    return explanations, shap_explanation, lime_explanation

# Thực hiện phân tích và giải thích
recommendations, kmeans_model = recommend_courses(grades_df)
explanations, shap_explanation, lime_explanation = explain_recommendations(grades_df, recommendations, kmeans_model)

# Tạo kết quả trả về
result = {
    'studentID': student_id,
    'recommendedCourses': recommendations,
    'explanations': explanations,
    'shapExplanation': shap_explanation,  # Giải thích SHAP
    'limeExplanation': [str(exp) for exp in lime_explanation]  # Giải thích LIME
}

# Trả kết quả về server (in ra JSON)
print(json.dumps(result))
