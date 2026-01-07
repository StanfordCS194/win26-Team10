from datetime import datetime

def check_year(year):
    """
        Check if specific year specified, if not return current year
    """
    if not year or year == 0:
        now = datetime.now()
        year = now.year  # calendar year
        if now.month < 7:
            year -= 1

    return year


VALID_GERS = [
    "WAY-A-II",
    "WAY-AQR",
    "WAY-CE",
    "WAY-EDP",
    "WAY-ER",
    "WAY-FR",
    "WAY-SI",
    "WAY-SMA",
    "Writing 1",
    "Writing 2",
    "Writing SLE",
    "College",
    "Language"
]

TIME_FORMAT = '%I:%M:%S %p'

BASE_TIME = datetime.strptime('', '')

BULLETIN_FORCE_LIST = ('course', 'section', 'schedule', 'instructor', 'attribute', 'tag', 'learningObjective')
BULLETIN_META_KEYS = ('subject', 'code', 'title', 'description', 'grading', 'unitsMin', 'unitsMax')
BULLETIN_QUARTERS_ABREVIATED = ["Aut", "Win", "Spr", "Sum"]

DAY_TO_NUM = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
QUARTERS_LONG_TO_ABREVIATED = {"Autumn": "Aut", "Winter": "Win", "Spring": "Spr", "Summer": "Sum"}

roleMappings = ['PI', 'SI', 'GP', 'TA']


# BULLETIN HELPER FUNCTIONS

def postprocessor(path, key, value):
    if value and key[:-1] in BULLETIN_FORCE_LIST:
        return key, value[key[:-1]]
    else:
        return key, value


def parse_time(s):
    if not s:
        return 0

    dt = datetime.strptime(s, TIME_FORMAT)
    return (dt - BASE_TIME).total_seconds()

def parseGERs(gerStr):
    gerSplit = gerStr.split(', ')
    gers = [item for item in gerSplit if item in VALID_GERS]
    return gers

def processSectionID(quarterDesc):
    split = quarterDesc.split(" ")
    quarter = split[1][0:3]
    return quarter

def order_IDs_by_role(dct):
    keys = list(dct.keys())
    if len(keys) == 0:
        return keys
    
    if isinstance(dct[keys[0]], dict):
        keys = sorted(keys, key=lambda x: roleMappings.index(dct[x]['role']))
    else:
        keys = sorted(keys, key=lambda x: roleMappings.index(dct[x][2]))
    return keys
    

def filter_by_role(dct, sorted_ids):
    if isinstance(dct[sorted_ids[0]],dict):
        first_role = dct[sorted_ids[0]]['role']
        keys = [x for x in sorted_ids if dct[x]['role'] == first_role]
    else:
        first_role = dct[sorted_ids[0]][2]
        keys = [x for x in sorted_ids if dct[x][2] == first_role]
    return keys

# CATALOG HELPER FUNCTIONS
def parse_time_to_human(s):
    # convert 1:30:00 PM to 1:30 PM
    if not s:
        return ""
    
    dt = datetime.strptime(s, TIME_FORMAT)
    return dt.strftime('%-I:%M %p')

def camelCase(s):
    return s[0].upper() + s[1:]

def cleanData(data):
    # Process the JSON data
    seen = set()
    toDelete = []
    boolKeys = ['AUT', 'WIN', 'SPR', 'SUM', 'onMon', 'onTue', 'onWed', 'onThu', 'onFri', 'onSat', 'onSun', 'finalExam']
    for i, item in enumerate(data):
        # make the year an int
        if type(item['year']) == str:
            item['year'] = int(item['year'])
        
        # remove space from course code
        item['courseCode'] = item['courseCode'].replace(' ', '')
        
        # make booleans ints:
        for key in boolKeys:
            if key in item:
                item[key] = 1 if item[key] else 0
        
        # no duplicate ids
        if item['id'] in seen:
            toDelete.append(i)
        
        # default medianGrade is -1:
        if 'medianGrade' not in item:
            item['medianGrade'] = -1
        
        seen.add(item['id'])

    for i in reversed(toDelete):
        del data[i]

    return data
