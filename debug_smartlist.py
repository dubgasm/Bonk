#!/usr/bin/env python3
"""
Debug script to check pyrekordbox SmartList enums
"""

import sys
import os

# Add pyrekordbox to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pyrekordbox-0.4.4'))

try:
    from pyrekordbox.db6.smartlist import SmartList, Property, Operator, LogicalOperator

    print("=== Property Enum Members ===")
    for prop in Property:
        print(f"{prop.name}: {prop.value}")

    print("\n=== Operator Enum Members ===")
    for op in Operator:
        print(f"{op.name}: {op.value}")

    print("\n=== LogicalOperator Enum Members ===")
    for logic in LogicalOperator:
        print(f"{logic.name}: {logic.value}")

    print("\n=== Testing SmartList Creation ===")
    try:
        smart = SmartList(logical_operator=1)  # LogicalOperator.ALL
        print("SmartList created successfully")

        # Try to add a condition
        smart.add_condition(Property.GENRE, Operator.EQUAL, "House")
        print("Condition added successfully")

    except Exception as e:
        print(f"Error creating SmartList: {e}")

except ImportError as e:
    print(f"Failed to import pyrekordbox: {e}")
except Exception as e:
    print(f"Error: {e}")