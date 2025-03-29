import pandas as pd
from functools import lru_cache
from config import COURSES_DATA_PATH

@lru_cache(maxsize=1)
def load_courses():
    courses_df = pd.read_csv(COURSES_DATA_PATH)
    return {
        row['Course']: {
            'credits': row['Credits'],
            'difficulty': row['Difficulty'],
            'category': row.get('Category', 'General')
        }
        for _, row in courses_df.iterrows()
    }

def get_advanced_courses(course):
    advanced_mapping = {
        "Math": ["Toán nâng cao", "Giải tích"],
        "Lý cơ bản": ["Lý nâng cao", "Vật lý lượng tử"],
    }
    return advanced_mapping.get(course, [])