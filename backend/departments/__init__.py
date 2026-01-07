from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd


def all_departments(csv_path: Optional[str | Path] = None) -> list[str]:
    """
    Return the list of department/subject codes (the `name` column).

    By default this reads `departments.csv` in the same directory as this module.
    """
    path = Path(csv_path) if csv_path is not None else Path(__file__).resolve().parent / "departments.csv"
    df = pd.read_csv(path)
    return df["name"].tolist()


