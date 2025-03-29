import pandas as pd

def prepare_student_data(data):
    students = data.get('students', [])
    
    # Validate input
    if not students or not isinstance(students, list):
        return None

    grades_data = []
    student_ids = []
    
    for student in students:
        # Check required fields
        if not isinstance(student, dict):
            continue
        if not student.get('studentID') or not student.get('grades'):
            continue
            
        grades_data.append(list(student['grades'].values()))
        student_ids.append(student['studentID'])
    
    # Check if we have valid data
    if not grades_data:
        return None
    
    # Create DataFrame with student IDs as index
    try:
        grades_df = pd.DataFrame(
            data=grades_data,
            columns=list(students[0]['grades'].keys()),
            index=student_ids
        )
        return student, student_ids, grades_df
    except Exception as e:
        print(f"Error creating DataFrame: {str(e)}")
        return None