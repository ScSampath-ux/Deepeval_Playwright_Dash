import os
import sys

# Disable DeepEval telemetry globally before any tests or deepeval imports run
os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"
os.environ["DEEPEVAL_TELEMETRY"] = "no"

# Ensure project root, src, and evals are in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
