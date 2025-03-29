from sklearn.cluster import KMeans
from services.recommendation import recommend_courses
from services.explanation import generate_explanations, explain_with_shap, explain_with_lime
from config import MIN_STUDENTS_FOR_MODEL
import numpy as np
from models.student_model import prepare_student_data
import logging

# Thiết lập logging
logger = logging.getLogger(__name__)

def analyze_students(students):
    """
    Phân tích dữ liệu sinh viên và trả về kết quả gợi ý khóa học
    
    Args:
        students: Danh sách sinh viên cần phân tích
        
    Returns:
        List: Danh sách kết quả phân tích cho từng sinh viên
        None: Nếu có lỗi xảy ra
    """
    try:
        # 1. Kiểm tra và chuẩn bị dữ liệu đầu vào
        if not students or not isinstance(students, list):
            logger.error("Invalid input: students should be a non-empty list")
            return None
            
        # 2. Tiền xử lý dữ liệu
        grades_df = prepare_student_data(students)
        if grades_df is None:
            logger.error("Failed to prepare student data")
            return None
            
        # 3. Khởi tạo kết quả
        results = []
        
        # 4. Xây dựng mô hình phân cụm nếu đủ dữ liệu
        use_ml, kmeans_model = build_clustering_model(grades_df)
        
        # 5. Xử lý từng sinh viên
        for idx, student_id in enumerate(grades_df.index):
            try:
                grades = {col: grades_df.iloc[idx][col] for col in grades_df.columns}
                
                # 5.1. Gợi ý khóa học
                recommendations, _ = recommend_courses(grades_df, grades)
                
                # 5.2. Tạo giải thích
                explanations, shap_exp, lime_exp = generate_explanations_with_ml(
                    grades_df, recommendations, kmeans_model, grades
                )
                
                # 5.3. Đóng gói kết quả
                results.append({
                    'studentID': str(student_id),
                    'recommendedCourses': [str(course) for course in recommendations],
                    'explanations': explanations,
                    'shapExplanation': shap_exp or [],
                    'limeExplanation': lime_exp or []
                })
                
            except Exception as e:
                logger.error(f"Error processing student {student_id}: {str(e)}")
                continue
                
        return results if results else None

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}", exc_info=True)
        return None

def build_clustering_model(grades_df):
    """Xây dựng mô hình phân cụm nếu đủ dữ liệu"""
    try:
        if len(grades_df) >= MIN_STUDENTS_FOR_MODEL:
            n_clusters = min(3, len(grades_df))
            kmeans_model = KMeans(
                n_clusters=n_clusters,
                random_state=42,
                n_init='auto'
            ).fit(grades_df)
            return True, kmeans_model
    except Exception as e:
        logger.warning(f"Clustering model failed: {str(e)}")
    
    return False, None

def generate_explanations_with_ml(grades_df, recommendations, model, grades):
    """
    Tạo giải thích sử dụng phương pháp ML
    
    Args:
        grades_df: DataFrame chứa điểm số
        recommendations: Danh sách khóa học được gợi ý
        model: Mô hình phân cụm
        grades: Điểm số của sinh viên
        
    Returns:
        Tuple: (explanations, shap_explanation, lime_explanation)
    """
    explanations = generate_explanations(recommendations, grades)
    shap_exp = []
    lime_exp = []
    
    # Chỉ tạo giải thích ML nếu có đủ sinh viên
    if len(grades_df) >= 2:
        model_to_use = model or KMeans(
            n_clusters=min(2, len(grades_df)),
            random_state=42,
            n_init='auto'
        )
        
        # Fit model tạm nếu cần
        if model is None:
            try:
                model_to_use.fit(grades_df)
            except Exception as e:
                logger.warning(f"Temporary model fitting failed: {str(e)}")
                return explanations, shap_exp, lime_exp
        
        # SHAP Explanation
        try:
            shap_exp = explain_with_shap(
                grades_df, 
                model_to_use,
                {'studentID': grades_df.index[0], 'grades': grades}
            )
        except Exception as e:
            logger.warning(f"SHAP explanation failed: {str(e)}")
        
        # LIME Explanation
        try:
            lime_exp = explain_with_lime(
                grades_df,
                model_to_use,
                {'studentID': grades_df.index[0], 'grades': grades}
            )
        except Exception as e:
            logger.warning(f"LIME explanation failed: {str(e)}")
    
    return explanations, shap_exp, lime_exp