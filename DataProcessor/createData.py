import pandas as pd

# Dữ liệu courses
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

# Chuyển đổi thành danh sách các dòng
data = []
for course, details in courses.items():
    data.append([course, details['credits'], details['difficulty']])

# Tạo DataFrame
df = pd.DataFrame(data, columns=['Course', 'Credits', 'Difficulty'])

# Lưu thành file CSV
df.to_csv('coursesData.csv', index=False)
print("File 'coursesData.csv' đã được tạo thành công!")