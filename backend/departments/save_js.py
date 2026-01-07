"""
Converts departments.csv to a JavaScript file with a list of departments and a 
dictionary mapping each department to a list of subjects with their names and long names.
used in CatalogConstants.js
"""

import pandas as pd

def departments_df_to_js(df: pd.DataFrame) -> str:
    """
    Convert a departments DataFrame into JavaScript source.

    Expected columns: 'longname', 'name', 'school'
    """
    departments = sorted(set(df["school"]))

    departments_to_subjects: dict[str, list[list[str]]] = {}
    for school in departments:
        subjects = df[df["school"] == school][["name", "longname"]].values.tolist()
        departments_to_subjects[school] = subjects

    output_js = "export const DEPARTMENTS = [\n"
    output_js += "    " + ",\n    ".join(f'"{department}"' for department in departments)
    output_js += "\n];\n\n"

    output_js += "export const DEPARTMENTS_TO_SUBJECTS = {\n"
    for school, subjects in departments_to_subjects.items():
        output_js += f'    "{school}": [\n'
        for subject in subjects:
            output_js += f'        ["{subject[0]}", "{subject[1]}"],\n'
        output_js = output_js.rstrip(",\n") + "\n"
        output_js += "    ],\n"
    output_js = output_js.rstrip(",\n") + "\n"
    output_js += "};"

    return output_js


def save_departments_js(df: pd.DataFrame, output_path: str = "output.js") -> str:
    """
    Write `convert_output.js` (or another output path) and return the JS source.
    """
    output_js = departments_df_to_js(df)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output_js)
    return output_js


if __name__ == "__main__":
    # CLI behavior: read departments.csv from the current working directory
    # (typically `backend/departments/`) and write convert_output.js.
    departments_df = pd.read_csv("./departments.csv")
    save_departments_js(departments_df)
