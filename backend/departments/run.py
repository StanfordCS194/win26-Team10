import sys
sys.path.append('../')  # Adjust the relative path as needed

import requests
import argparse
from bs4 import BeautifulSoup
import pandas as pd
from helpers.general import check_year
from helpers.headers import EXPLORE_COURSE_HEADERS
from save_js import save_departments_js

def main() -> None:
    parser = argparse.ArgumentParser(description="Extract year from command line")
    parser.add_argument("--year", type=int, help="Year to be processed", default=0)
    args = parser.parse_args()

    year = check_year(args.year)
    YEAR = f"{year}{year+1}"
    url = f"https://explorecourses.stanford.edu/browse?academicYear={YEAR}"
    response = requests.request("GET", url, headers=EXPLORE_COURSE_HEADERS, timeout=30)
    soup = BeautifulSoup(response.text, "html.parser")

    currentDep = ""
    df = pd.DataFrame(columns=["longname", "name", "school"])

    for item in soup.find_all("ul"):
        currentDep = (
            item.attrs["title"]
            .replace(" - part 1", "")
            .replace(" - part 2", "")
            .replace(" departments", "")
        )
        if currentDep == "Office of Vice Provost for Teaching and Learning":
            break
        for li in item.find_all("li"):
            print(li.text.strip())
            split = li.text.strip().split(" (")
            name = split[0]
            code = split[1][:-1]
            df.loc[len(df.index)] = [name, code, currentDep]

    df.to_csv("departments.csv", index=False)
    save_departments_js(df, output_path="convert_output.js")


if __name__ == "__main__":
    main()
