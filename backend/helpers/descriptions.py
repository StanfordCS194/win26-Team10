from __future__ import annotations

import html
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import pandas as pd


_MAPPINGS_SHORT_TO_CODE = {
    "PE": "PHYSWELL",
    "FP": "FILMPROD",
    "ENGL": "ENGLISH",
    "IR": "INTNLREL",
}


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def _department_codes() -> set[str]:
    """
    Load department codes (subject codes) from backend/departments/departments.csv.
    """
    departments_path = _backend_dir() / "departments" / "departments.csv"
    df = pd.read_csv(departments_path)
    if "name" not in df.columns:
        return set()
    return {str(x).strip().upper() for x in df["name"].tolist() if str(x).strip()}


def _get_class_num_prefix(token: str) -> str:
    prefix = ""
    for ch in token:
        if ch.isdigit() or ch.isalpha():
            prefix += ch
        else:
            break
    return prefix


def _token_is_class_num(token: str) -> bool:
    if not token:
        return False
    if not token[0].isdigit():
        return False
    for ch in token:
        if ch.isdigit():
            continue
        if ch.isalpha() and ch.isupper():
            continue
        if ch.isalpha():
            return False
        break
    return True


def _num_digits(token: str) -> int:
    digits = 0
    while digits < len(token) and token[digits].isdigit():
        digits += 1
    return digits


def surround_links_with_curly_braces(text: str) -> str:
    # Wrap URLs with {{ }} so we don't try to [[link]] inside them.
    url_pattern = r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+~]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+"
    replaced = re.sub(url_pattern, r"{{\g<0>}}", text)

    # Move punctuation outside the closing braces.
    for punc in [".", ",", ";", ":", "!", "?"]:
        replaced = replaced.replace(punc + "}}", "}}" + punc)

    replaced = re.sub(r" \)", ")", replaced)
    return replaced


def clean_unicode(text: str) -> str:
    ans = html.unescape(text)
    ans = ans.replace(" &lt;br&gt;&lt;br&gt;", "")
    return ans


def _convert_description_better(desc: str, dept: str) -> str:
    dep_list = _department_codes()
    # Normalize commas.
    desc = re.sub(r",(?![ ])", ", ", desc)

    # Format specific annoying cases like CS103B/X, CS106B/X, CS106B or X
    desc = re.sub(r"103B/X", "103B or 103X", desc)
    desc = re.sub(r"106B/X", "106B or 106X", desc)
    desc = re.sub(r"106B or X", "106B or 106X", desc)

    # Add a space after every open parenthesis and slash (removed after).
    desc = re.sub(r"\(", "( ", desc)
    desc = re.sub(r"\)", " )", desc)
    desc = re.sub(r"/", "/ ", desc)

    # Convert tokens like Stats200 -> STATS 200 when token prefix matches a dept.
    new_tokens: list[str] = []
    within_link = False
    for token in desc.split(" "):
        i = 0
        while i < len(token) and token[i].isalpha():
            i += 1
        j = i
        while j < len(token) and token[j].isdigit():
            j += 1

        if "{{" in token:
            within_link = True

        token_prefix = token[:i].upper()
        if (
            token_prefix
            and not within_link
            and (token_prefix in dep_list or token_prefix in _MAPPINGS_SHORT_TO_CODE)
            and (j - i) >= 1
        ):
            if token_prefix in _MAPPINGS_SHORT_TO_CODE:
                new_tokens.append(_MAPPINGS_SHORT_TO_CODE[token_prefix] + " " + token[i:])
            else:
                new_tokens.append(token_prefix + " " + token[i:])
        else:
            new_tokens.append(token)

        if "}}" in token:
            within_link = False

    desc = " ".join(new_tokens)

    # Surround likely course tokens with [[ ]].
    sentences = desc.split(".")
    new_sentences: list[str] = []
    within_link = False

    prev_dept = dept.upper()
    for sentence in sentences:
        words = sentence.split(" ")
        dept_specified = False
        prev_dept = dept.upper()
        new_words: list[str] = []

        for word in words:
            if "{{" in word:
                within_link = True

            if dept_specified:
                if not word:
                    new_words.append(word)
                    continue

                if _token_is_class_num(word) and _num_digits(word) >= 3:
                    prefix = _get_class_num_prefix(word)
                    suffix = word[len(prefix) :]
                    new_words.pop()
                    new_words.append(f"[[{prev_dept} {prefix}]]{suffix}")
                else:
                    new_words.append(word)
                dept_specified = False
            else:
                w_up = word.upper()
                if within_link:
                    new_words.append(word)
                elif w_up in dep_list or w_up in _MAPPINGS_SHORT_TO_CODE:
                    prev_dept = w_up if w_up in dep_list else _MAPPINGS_SHORT_TO_CODE[w_up]
                    new_words.append(word)
                    dept_specified = True
                elif (
                    word
                    and _token_is_class_num(word)
                    and _num_digits(word) >= 3
                ):
                    prefix = _get_class_num_prefix(word)
                    suffix = word[len(prefix) :]
                    new_words.append(f"[[{prev_dept} {prefix}]]{suffix}")
                else:
                    new_words.append(word)

            if "}}" in word:
                within_link = False

        new_sentences.append(" ".join(new_words))

    desc = ".".join(new_sentences)

    # Remove temporary spaces.
    desc = re.sub(r"\( ", "(", desc)
    desc = re.sub(r" \)", ")", desc)
    desc = re.sub(r"/ ", "/", desc)
    return desc


def process_desc(text: str, dept: str) -> str:
    """
    Process a raw course description into a cleaned, linkified description.

    - Wrap URLs as {{...}}
    - Normalize unicode and spacing
    - Surround course tokens like "CS 106A" as [[CS 106A]]
    """
    if not isinstance(text, str):
        return ""
    ans = clean_unicode(text)
    ans = surround_links_with_curly_braces(ans)
    return _convert_description_better(ans, dept)


