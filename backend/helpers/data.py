import ast


def parse_literal(value: str):
    """
    Parse a Python literal stored as a string (e.g. "[1, 2, 3]").
    """
    return ast.literal_eval(value)


def normalize_code(code: str) -> str:
    """
    Normalize course codes for document keys (strip spaces).
    """
    return code.replace(" ", "")


