import pandas as pd
import numpy as np
import shap
import lime
import lime.lime_tabular
from sklearn.cluster import KMeans

# Đọc dữ liệu từ CSV
df = pd.read_csv("./DataProcessor/Processed_StudentsPerformance.csv")

# Nhập mã sinh viên từ bàn phím
student_id = input("Nhập mã sinh viên: ").strip()

# Tìm dữ liệu của sinh viên đó
if student_id not in df["studentID"].values:
    print(f"Không tìm thấy sinh viên có mã {student_id}")
    exit()

student_data = df[df["studentID"] == student_id].drop(columns=["studentID"])
grades = student_data.iloc[0].to_dict()

# Dữ liệu mẫu môn học
courses = {
    'Math': {'credits': 3, 'difficulty': 0.8},
    'Reading': {'credits': 3, 'difficulty': 0.6},
    'Writing': {'credits': 3, 'difficulty': 0.7},
    'Biology': {'credits': 3, 'difficulty': 0.5},
}

grades_df = df.drop(columns=["studentID"])

# Hàm dự đoán xác suất cụm cho LIME
def predict_probabilities(model, X):
    clusters = model.predict(X)
    probs = np.zeros((X.shape[0], model.n_clusters))
    for i, cluster in enumerate(clusters):
        probs[i, cluster] = 1  
    return probs

# Hàm phân tích điểm số và đưa ra khuyến nghị
def recommend_courses(grades_df, student_data):
    if grades_df.shape[0] == 1:
        recommendations = [c for c in courses.keys() if c not in student_data.keys()]
        return recommendations[:2], None  

    kmeans = KMeans(n_clusters=min(2, len(grades_df)), random_state=0, n_init=10).fit(grades_df)
    
    recommendations = [sub for sub, score in student_data.items() if score < 7]
    if not recommendations:
        recommendations = [c for c in courses.keys() if c not in student_data.keys()][:2]

    return recommendations, kmeans

# Hàm giải thích bằng SHAP và LIME
def explain_recommendations(student_data, recommendations, kmeans_model):
    explanations, shap_explanation, lime_explanation = [], [], []
    feature_names = list(student_data.keys())
    X = np.array([list(student_data.values())])

    if kmeans_model:
        # SHAP
        explainer_shap = shap.KernelExplainer(kmeans_model.predict, X)
        shap_values = explainer_shap.shap_values(X)

        for i, feature in enumerate(feature_names):
            shap_value = shap_values[0][i]
            if shap_value > 0:
                shap_explanation.append(f"{feature} (SHAP value: {shap_value:.2f}) có ảnh hưởng lớn")

        # LIME
        explainer_lime = lime.lime_tabular.LimeTabularExplainer(
            training_data=grades_df.values,
            feature_names=feature_names,
            mode='classification',
            random_state=0
        )
        lime_exp = explainer_lime.explain_instance(X[0], lambda x: predict_probabilities(kmeans_model, x), num_features=3)
        lime_explanation = lime_exp.as_list()

    for rec in recommendations:
        if rec in student_data:
            explanations.append(f"{rec} được đề xuất vì điểm của bạn là {student_data[rec]}, thấp hơn ngưỡng 7.")
        else:
            explanations.append(f"{rec} được đề xuất vì đây là môn mới, phù hợp với bạn.")

    return explanations, shap_explanation, lime_explanation

# Thực hiện phân tích
recommendations, kmeans_model = recommend_courses(grades_df, grades)
explanations, shap_explanation, lime_explanation = explain_recommendations(grades, recommendations, kmeans_model)

# In kết quả
print(f"\n🔹 Sinh viên: {student_id}")
print(f"📌 Môn học đề xuất: {', '.join(recommendations)}")
print("📖 Lý do:")
for exp in explanations:
    print(f"- {exp}")

if shap_explanation:
    print("\n📊 SHAP Explanation:")
    for exp in shap_explanation:
        print(f"- {exp}")

if lime_explanation:
    print("\n🟢 LIME Explanation:")
    for exp in lime_explanation:
        print(f"- {exp[0]}: {exp[1]:.2f}")

