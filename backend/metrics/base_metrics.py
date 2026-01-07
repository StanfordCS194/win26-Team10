"""
One-time setup script: run once to initialize "base metrics" fields in Firestore.

Reads `data/carta_metrics.csv` and writes `hours`, `outcomes`, and `years` onto
documents in the `Metrics` collection keyed by course code.
"""

import argparse
import asyncio

import pandas as pd
from alive_progress import alive_bar

from ..helpers.data import parse_literal, normalize_code

async def upload_metrics_row(row):
    hours = None if isinstance(row["hours"], float) else parse_literal(row["hours"])
    outcomes = None if isinstance(row["outcomes"], float) else parse_literal(row["outcomes"])
    years = None if isinstance(row["years"], float) else parse_literal(row["years"])
    _code = normalize_code(row["code"])
    _updates = {"hours": hours, "outcomes": outcomes, "years": years}

    # Skip no-op rows to reduce traffic.
    if hours is None and outcomes is None and years is None:
        return []

    # DB disabled for now:
    # ref = db_as.collection("Metrics").document(_code)
    # return [ref.update(_updates)]
    return []


async def upload_all(df_metrics):
    allTasks = []
    with alive_bar(len(df_metrics), force_tty=True) as bar:
        for _, row in df_metrics.iterrows():
            allTasks += await upload_metrics_row(row)

            if len(allTasks) > 200:
                await asyncio.gather(*allTasks)
                allTasks = []

            bar()

        if allTasks:
            await asyncio.gather(*allTasks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload base metrics to Firestore (run once).")
    parser.add_argument("--csv", default="data/carta_metrics.csv", help="Path to carta_metrics.csv")
    parser.add_argument("--creds", default="../account.json", help="Path to Firebase service account json")
    args = parser.parse_args()

    df_metrics = pd.read_csv(args.csv)
    df_metrics.set_index(df_metrics.columns[0], inplace=True)
    df_metrics.columns = ["code", "id", "hours", "outcomes", "years"]

    # asyncio.run(upload_all(df_metrics, db_as))


if __name__ == "__main__":
    main()
