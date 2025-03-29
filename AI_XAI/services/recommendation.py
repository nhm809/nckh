from models.course_model import load_courses, get_advanced_courses
from config import MAX_RECOMMENDATIONS
import numpy as np

courses = load_courses()

def recommend_courses(grades_df, grades):
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