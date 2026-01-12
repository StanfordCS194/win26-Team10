# conda activate virtualPy
# python downloadBulletin.py 2024 
# if startIndex=100 and including search : python downloadBulletin.py 2024 true 100


import sys
sys.path.append('../')

from departments import all_departments

from descriptions.processDescriptions import processDesc
from metrics.helpers import get_latest_metrics_file, get_hour_and_grade_map, get_syllabi_map
from reviewProcessing.helpers import get_reviews_map, merge_reviews_and_instructors
from helpers.general import check_year
from helpers.headers import BULLETIN_FORCE_LIST, BULLETIN_META_KEYS, BULLETIN_QUARTERS_ABREVIATED, DAY_TO_NUM, QUARTERS_LONG_TO_ABREVIATED
from helpers import postprocessor, parse_time, parseGERs, order_IDs_by_role, filter_by_role
from helpers import extract_prerequisites, TreeBuilder

import requests
import xmltodict
import re
import pandas as pd
from alive_progress import alive_bar
import asyncio
import json
from firebase_admin import firestore_async
import firebase_admin
from firebase_admin import credentials
import argparse
import collections
import concurrent.futures

# Create the parser
parser = argparse.ArgumentParser(description='Extract year from command line')

# Add the year argument
parser.add_argument('year', type=int, help='Year to be processed')
parser.add_argument('includeSearch', type=bool, nargs='?', default=False, help='Start index to be processed (default: 0)')
parser.add_argument('startIndex', type=int, nargs='?', default=0, help='Start index to be processed (default: 0)')

# Parse the command line arguments
args = parser.parse_args()
year, startIndex, includeSearch = check_year(args.year), args.startIndex, args.includeSearch
YEAR = f"{year}{year+1}"
print(f"Begining scraping for {year} ({YEAR})")

INSTRUCTOR_PATH = "Instructor_QTR_DATA/combined.json"

metrics = get_latest_metrics_file()
hourMap, gradeMap = get_hour_and_grade_map(metrics)
reviews = get_reviews_map()
syllabiMap = get_syllabi_map()
allCoursesLookup = set(pd.read_csv("../allClasses/allCoursesLatest.csv")["courseName"].tolist())

# Proxy configuration - replace with your actual Squid proxy details
# PROXY_LIST = [
#     'http://proxy1.example.com:3128',
#     'http://proxy2.example.com:3128',
#     'http://proxy3.example.com:3128',
#     # Add more proxies as needed
# ]

# def get_proxy():
#     """Return a random proxy from the list"""
#     return random.choice(PROXY_LIST)

with open(INSTRUCTOR_PATH, "r") as f:
    instructorData = json.load(f)
    
reviewFinalMap = merge_reviews_and_instructors(reviews, instructorData)

def processSections(sections: list):
    # TODO: Add in deletion of startTime duplicates
    if not sections:
        return {}, []
    
    sectionsToSectionsMap = {}
    for q in BULLETIN_QUARTERS_ABREVIATED:
        sectionsToSectionsMap[q] = []

    sections.sort(key=lambda c: c['sectionNumber'])

    for section in sections:
        if section["sectionNumber"] > "05":
            break

        qtrLong = section['term'].split(" ")[1]
        abreviated = QUARTERS_LONG_TO_ABREVIATED[qtrLong]
        sectionsToSectionsMap[abreviated].append(section)

    # remove empty lists
    sectionsToSectionsMap = {q: schedules for q, schedules in sectionsToSectionsMap.items() if len(schedules) > 0}

    qtr_to_instructor = {}

    # QTR to sections
    qtrToSections = {q: [] for q in sectionsToSectionsMap.keys()}

    for qtr, sectionsInQtr in sectionsToSectionsMap.items():
        for section in sectionsInQtr:
            PLUCK_SECTION_KEYS = ('sectionNumber', 'component', 'notes', 'classId', 'currentClassSize', 'maxClassSize')
            gen_section = {k: section[k] for k in PLUCK_SECTION_KEYS}
            gen_section["term"] = qtr
            gen_section['schedules'] = []
            
            for schedule in section["schedules"]:
                startTimestamp = parse_time(schedule['startTime'])
                endTimestamp = parse_time(schedule['endTime'])
                location = schedule['location']
                
                # Fix whitespace in days
                if schedule['days']:
                    days = re.sub(r'\s+', ' ', schedule['days']).strip()
                else:
                    days = None

                if schedule['instructors']: 
                    for instructor in schedule["instructors"]:
                        # Handle instrucotrs for general
                        if qtr not in qtr_to_instructor:
                            qtr_to_instructor[qtr] = {}

                        instructorData = [instructor["firstName"], instructor["lastName"], instructor["role"], instructor["name"]]
                        qtr_to_instructor[qtr][instructor["sunet"]] = instructorData

                    instructors = [({
                        'name': i['name'], 'sunet': i['sunet']
                    }) for i in schedule['instructors']]

                else:
                    instructors = []

                gen_section['schedules'].append({
                    "days": days,
                    "startTimestamp": startTimestamp,
                    "endTimestamp": endTimestamp,
                    "location": location,
                    "instructors": instructors,
                    "startTime": schedule['startTime'],
                    "endTime": schedule['endTime']
                })
            
            qtrToSections[qtr].append(gen_section)

    return qtrToSections, qtr_to_instructor


MAX_RETRIES = 3

def processDepartment(department: str, dept_to_data: dict, preq_nodes: dict = {}):
    url = f"https://explorecourses.stanford.edu/search?view=xml-20140630&academicYear={YEAR}&page=0&q={department}&filter-departmentcode-{department}=on" 
    response = requests.request("GET", url)

    # api_url =  "https://api.scraperapi.com?api_key=733d85355804ad3b1eef212b16446d1b&url="+url
    # response = requests.request("GET", api_url)
    body = xmltodict.parse(response.text, force_list=BULLETIN_FORCE_LIST, postprocessor=postprocessor)
    # print(body)
    # sys.exit()

    # retries, body = 5, None

    # while retries > 0 and not body:
    #     response = requests.request("GET", url) #, headers=EXPLORE_COURSE_HEADERS)
    #     try:
    #         body = xmltodict.parse(response.text, force_list=BULLETIN_FORCE_LIST, postprocessor=postprocessor)
    #     except Exception as e:
    #         # print(f"Error in parsing {department} with response {response.text}")
    #         # traceback.print_exc()
    #         # sys.exit()
    #         retries -= 1
    #         print("rate limit, sleepy...")
    #         time.sleep(20)
        
    # if not body:
    #     print(f"Failed to get {department}")
    #     return

    courses = body['xml']['courses']

    if not courses:
        return []

    for course in courses:
        generated, qtrToSections, preqs = processClass(course, department)
        courseCode = generated["courseCode"]
        dept_to_data[department].append((generated, qtrToSections))
        
        # if id == "CS107":
        #     print(preqs)
        pre_reqs_set = set(preqs)
        if courseCode in pre_reqs_set: # if present, remove it (self reference)
            pre_reqs_set.remove(courseCode)
            
        # remove courses that are not in the allCoursesLookup
        pre_reqs_set = pre_reqs_set.intersection(allCoursesLookup)
        
        preq_nodes[courseCode] = list(pre_reqs_set)

    

    # time.sleep(1)

def processClass(course, department):
    generated = {k: course[k] for k in BULLETIN_META_KEYS}
    id = f"{generated['subject']}{generated['code']}"

    generated['unitsMin'] = int(generated['unitsMin'])
    generated['unitsMax'] = int(generated['unitsMax'])
    generated["id"] = id
    generated["courseCode"] = f"{generated['subject']} {generated['code']}"

    if type(course['description']) is str:
        generated['description'] = processDesc(course['description'], department)
    else:
        generated['description'] = ""

    # GER list for filtering
    if course['gers']:
        generated['gers'] = parseGERs(course['gers'])
    else:
        generated['gers'] = []

    if course['attributes'] != None:
        for quarter in course['attributes']:
            if quarter['value'] in BULLETIN_QUARTERS_ABREVIATED:
                generated[quarter['value']] = True
       
    generated['department'] = course['administrativeInformation']['academicGroup']
    generated['career'] = course['administrativeInformation']['academicCareer']
    generated['finalExam'] = (course['administrativeInformation']['finalExamFlag'] == 'Y')
    generated['maxTimesRepeated'] = int(course['administrativeInformation']['maxTimesRepeat'])

    # Add repeatable metric here
    if id in hourMap:
        hours = hourMap[id]
        generated["meanHours"] = round(hours[0], 2)
        generated["medianHours"] = round(hours[1], 2)

    if id in gradeMap:
        generated["medianGrade"] = gradeMap[id][0]
        generated["percentAs"] = gradeMap[id][1]
        
    if id in syllabiMap:
        generated["syllabus"] = syllabiMap[id]

    qtrToSections, qtr_to_instructor = processSections(course["sections"])

    # change made here untested 23 march due to rate limit
    instructorQuarters = {}
    instructorIDQuarters = {}
    for qtr in qtr_to_instructor:
        sorted_ids = order_IDs_by_role(qtr_to_instructor[qtr])
        filtered_ids = filter_by_role(qtr_to_instructor[qtr], sorted_ids)

        # lookup filtered ids and make a list of names, -1 to remove trailing dot
        instructorQuarters[qtr] = [ qtr_to_instructor[qtr][id][3][:-1] for id in filtered_ids ]
        instructorIDQuarters[qtr] = filtered_ids
    
    generated['instructors'] = instructorQuarters
    generated['instructorIDs'] = instructorIDQuarters

    # get COMPONENT by getting first key and then getting component
    if len(qtrToSections.keys()) > 0:
        generated["component"] = qtrToSections[list(qtrToSections.keys())[0]][0]["component"]
    else:
        generated["component"] = ""

    qtrsOffered = [False, False, False, False]
    for qtr in BULLETIN_QUARTERS_ABREVIATED:
        if qtr in qtrToSections:
            qtrsOffered[BULLETIN_QUARTERS_ABREVIATED.index(qtr)] = True
    generated['qtrs'] = qtrsOffered

    if id in reviewFinalMap:
        generated["pastReviews"] = reviewFinalMap[id]
        
    # Get children courses
    
    preqs = extract_prerequisites(course['description'], course['subject'])
    # if generated["id"] == "CS107":
    #     print(course["description"])
    #     print(course["subject"])
    #     print(preqs)

    return generated, qtrToSections, preqs

async def upload(courseData, qtrToSections, yearCropped):
    id = courseData["id"]
    # ref = db_as.collection(ROOT_PATH).document(yearCropped).collection(id).document("meta")

    # sectionRef = db_as.collection(ROOT_PATH).document(yearCropped).collection(id)

    # async def upload_sections(sections, qtr):
    #     await sectionRef.document(qtr).set({"sections" : sections}, timeout=120.0)

    # Gather all tasks and run them concurrently
    # tasks = [upload_sections(sections, qtr) for qtr, sections in qtrToSections.items()]
    # tasks.append(ref.set(courseData, timeout=120.0))

    tasks = []

    return tasks

# Second Upload --- FOR NEW CLASES ONLY
async def uploadSearch(courseData, qtrToSections, yearCropped):
    if not includeSearch: return []

    id = courseData["id"]
    qtrs = courseData["qtrs"] # list of booleans
    qtrsOffered = [ BULLETIN_QUARTERS_ABREVIATED[i] for i in range(len(qtrs)) if qtrs[i] != False] # remove false values

    unitsMin = courseData["unitsMin"]
    unitsMax = courseData["unitsMax"]

    units = []
    for i in range(unitsMin, unitsMax + 1):
        units.append(i)

    searchDict = {
        "code": id,
        "title": courseData["title"],
        "titleSearch": courseData["title"].lower(),
        "description": courseData["description"].lower() if courseData["description"] != None else "",
        "units": units,
        "quartersOffered": qtrsOffered,
        "gers": courseData["gers"],
        "subject": courseData["subject"],
        # "days": list(days)
    }

    if "meanHours" in courseData:
        searchDict["meanHours"] = courseData["meanHours"]

    if "medianHours" in courseData:
        searchDict["medianHours"] = courseData["medianHours"]

    # searchRef = db_as.collection(SEARCH_PATH).document(id)
    # tasks = [searchRef.set(searchDict, timeout=120.0)]
    tasks = []
    return tasks


async def processDepartments(year: str, startIndex: int):
    departments = all_departments()

    with alive_bar(len(departments), force_tty=True) as bar:
        for i in range(startIndex):
            bar()
            
        dept_to_data, preq_nodes = collections.defaultdict(list), {}
        allTasks = []
        
        # fetch data
        # for department in departments[startIndex:]:
        #     processDepartment(department, dept_to_data, preq_nodes)
        #     bar()

        # Define the worker function
        def process_department_worker(department, dept_to_data, preq_nodes):
            processDepartment(department, dept_to_data, preq_nodes)

        # Create a ThreadPoolExecutor with 5 workers
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # Submit tasks to the executor
            futures = [executor.submit(process_department_worker, department, dept_to_data, preq_nodes)
                    for department in departments[startIndex:]]
            
            # Wait for all tasks to complete and update the progress bar
            for future in concurrent.futures.as_completed(futures):
                bar()
            
    # print(dept_to_data)
    # sys.exit()
            
    # save preq_nodes into preq_nodes.json 
    with open('prereq_nodes.json', 'w') as f:
        json.dump(preq_nodes, f)
            
    # read preq_nodes.json into preq_nodes
    # with open('prereq_nodes.json', 'r') as f:
    #     preq_nodes = json.load(f)
         
    prereq_tree = TreeBuilder(preq_nodes)  # topology sort
    
    # dump preq_nodes to json
    # with open('prereq_tree.json', 'w') as f:
    #     json.dump(prereq_tree.tree, f)
        
    # return

    with alive_bar(len(dept_to_data), force_tty=True) as bar:
        for department in dept_to_data:
            for courseData, qrtToSections in dept_to_data[department]:
                pre_req_relationships = prereq_tree.get_relationships(courseData["courseCode"])
                if pre_req_relationships:
                    courseData["prereqs"] = pre_req_relationships
                
                newTasks = await upload(courseData, qrtToSections, year[0:4])
                if newTasks:
                    allTasks += newTasks

                searchTask = await uploadSearch(courseData, qrtToSections, year[0:4])

                if newTasks:
                    allTasks += searchTask

            if len(allTasks) > 100:
                await asyncio.gather(*allTasks)
                allTasks = []
                    
            bar()
                
            # break
                
        await asyncio.gather(*allTasks)

        
async def main():
    global hourMap, gradeMap, startIndex
    await processDepartments(YEAR, startIndex)


if __name__ == "__main__":
    # Create an event loop
    loop = asyncio.get_event_loop()
    # Run the main function in the event loop
    loop.run_until_complete(main())