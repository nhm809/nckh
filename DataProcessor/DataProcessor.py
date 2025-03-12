import pandas as pd

file_path = "C:\\nckh\\DataSet\\StudentsPerformance_Updated.xlsx"

df = pd.read_excel(file_path, sheet_name = "StudentsPerformance", index_col = "studentID")
xls = pd.ExcelFile(file_path)

# print(xls.sheet_names)

# selected_df = df[['gender', 'math score','reading score', 'writing score']] df là các cột được chọn

columns_to_drop = ['race/ethnicity', 'parental_level_of_education', 'lunch', 'test_preparation_course']
df_filtered = df.drop(columns=columns_to_drop)

# df[['math_score', 'reading_score', 'writing_score']] /= 10

# with pd.ExcelWriter(file_path, mode="a", engine="openpyxl", if_sheet_exists="replace") as writer:
#     df.to_excel(writer, sheet_name="StudentsPerformance", index=True)  # Chỉ cập nhật sheet này
    
    
# def get_recommendation(score):
#     if 0 <= score <= 5:
#         return "Poor"
#     elif 5 < score <= 7:
#         return "Average"
#     else:
#         return "Good"
# df["Recommend"] = df.apply(lambda row: f"[Math]: {get_recommendation(row['math_score'])}, "
#                                        f"[Reading]: {get_recommendation(row['reading_score'])}, "
#                                        f"[Writing]: {get_recommendation(row['writing_score'])}", axis=1)   

# with pd.ExcelWriter(file_path, mode="a", engine="openpyxl", if_sheet_exists="replace") as writer:
#     df.to_excel(writer, sheet_name="StudentsPerformance", index=True)
    
    
    
df_filtered.info()
print(df_filtered)
