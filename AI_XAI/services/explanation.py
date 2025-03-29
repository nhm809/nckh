from models.course_model import load_courses, get_advanced_courses
from config import MAX_FEATURES_FOR_EXPLANATION, SHAP_THRESHOLD
import numpy as np
import shap
from sklearn.ensemble import RandomForestClassifier
import lime
import lime.lime_tabular
from sklearn.preprocessing import StandardScaler
import traceback

courses = load_courses()

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
            explanations.append(
                f"{course} phù hợp trình độ (độ khó: {diff:.2f}, tín chỉ: {cred}) - {diff_type} mức trung bình"
            )
    return explanations

def explain_with_shap(grades_df, model, student_data):
    try:
        variances = grades_df.var()
        valid_features = variances[variances > 0.01].index.tolist()
        
        if not valid_features or len(grades_df) < 2:
            return []
            
        X = grades_df[valid_features]
        
        rf = RandomForestClassifier(n_estimators=50, random_state=42)
        clusters = model.predict(X)
        rf.fit(X, clusters)
        
        explainer = shap.TreeExplainer(rf)
        shap_values = explainer.shap_values(X)
        
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
        ][:MAX_FEATURES_FOR_EXPLANATION]
        
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

def predict_probabilities(model, X):
    if model is None:
        return np.array([[0.5, 0.5]])
    clusters = model.predict(X)
    probs = np.zeros((X.shape[0], model.n_clusters))
    for i, cluster in enumerate(clusters):
        probs[i, cluster] = 1
    return probs