
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import pandas as pd

# Allow running this file directly (so `helpers` resolves cleanly).
_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(_BACKEND_DIR))

from helpers.data import parse_literal  # noqa: E402

avgHours = [2.5, 7.5, 12.5, 17.5, 22.5, 27.5, 32.5, 37.5]


def addTwoLists(a, b):
    return [x + y for x, y in zip(a, b)]


def getMedian(arr):
    arr = parse_literal(arr)
    midpoint = sum(arr) / 2
    runningTotal = 0

    for i in range(len(arr)):
        runningTotal += arr[i]
        if runningTotal >= midpoint:
            return avgHours[i]

    return avgHours[-1]


def hoursCalc(arr):
    arr = parse_literal(arr)
    am = sum(arr)
    t = 0
    for i in range(len(arr)):
        item = arr[i]
        t += item * avgHours[i]
    return t / am


def _sum_hours_cell(cell) -> list[int]:
    """
    Each yearly `hours` value is expected to be either:
    - a list[int] (length 8), or
    - a list[list[int]] (multiple distributions to aggregate)
    """
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return [0] * 8

    parsed = parse_literal(cell)
    if parsed == []:
        return [0] * 8

    # list[int]
    if isinstance(parsed, list) and len(parsed) == 8 and all(
        isinstance(x, (int, float)) for x in parsed
    ):
        return [int(x) for x in parsed]

    # list[list[int]]
    summed = [0] * 8
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, list) and len(item) == 8:
                summed = addTwoLists(summed, [int(x) for x in item])
    return summed


async def updateHours(_code, row):
    _hours = parse_literal(row["totalHours"])
    # codeFormatted = normalize_code(code)
    # ref = db_as.collection("Metrics").document(codeFormatted)
    # updates = {"hours": _hours}

    # avoid overwriting the document if it does exist
    # if present_past:
    #     return [ref.update(updates)]
    # else:
    #     return [ref.set(updates)]
    return []


async def upload(*, merged_df):
    allTasks = []

    for index, row in merged_df.iterrows():
        allTasks += await updateHours(index, row)

        if len(allTasks) > 200:
            print("uploading ....")
            await asyncio.gather(*allTasks)
            allTasks = []

    print("uploading ....")
    await asyncio.gather(*allTasks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract year from command line")
    parser.add_argument("year", type=int, help="Year to be processed")
    args = parser.parse_args()

    end_year = args.year

    dfs = []
    # Include the next calendar year (historically, hours data seems to be stored this way).
    for yr in range(2021, end_year + 2):
        metadata_path = str(Path(__file__).resolve().parents[1] / "evals" / "out" / f"metaData-{yr}.csv")
        if not os.path.exists(metadata_path):
            print(f"⚠️  Warning: {metadata_path} not found – skipping this year.")
            continue

        df = pd.read_csv(metadata_path)
        df.set_index(df.columns[0], inplace=True)
        if "hours" not in df.columns:
            print(f"⚠️  Warning: {metadata_path} missing 'hours' column – skipping this year.")
            continue

        # Keep columns as just the year (e.g. "2024"), not "hours_2024".
        df = df.rename(columns={"hours": str(yr)})
        df = df[[str(yr)]]
        dfs.append(df)

    for i, df in enumerate(dfs):
        if not df.index.is_unique:
            print(f"❌ DataFrame at index {i} has non-unique index values:")
            print(df.index[df.index.duplicated()].value_counts())
        else:
            print(f"✅ DataFrame at index {i} has a unique index.")

    merged_df = pd.concat(dfs, axis=1)

    # Snapshot hour columns before adding derived columns to avoid KeyErrors during iteration.
    hour_cols = merged_df.columns.tolist()

    totals = []
    for _, row in merged_df.iterrows():
        hours_summed = [0] * 8
        for col_name in hour_cols:
            hours_summed = addTwoLists(hours_summed, _sum_hours_cell(row[col_name]))
        totals.append(str(hours_summed))

    merged_df["totalHours"] = totals

    merged_df = merged_df[merged_df["totalHours"] != str([0] * 8)]
    merged_df = merged_df[merged_df["totalHours"] != "[]"]

    merged_df["medianHours"] = merged_df["totalHours"].apply(getMedian)
    merged_df["meanHours"] = merged_df["totalHours"].apply(hoursCalc)

    out_path = Path(__file__).resolve().parent / "data" / f"hours_{end_year}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged_df.to_csv(out_path)
    print(f"✅ Wrote {out_path}")

    # Uncomment if you want to push hours to the DB.
    # asyncio.run(upload(merged_df=merged_df))


if __name__ == "__main__":
    main()