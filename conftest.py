import os
import sys

# Disable DeepEval telemetry and Confident AI cloud upload globally before any tests or deepeval imports run
os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"
os.environ["DEEPEVAL_TELEMETRY"] = "no"
os.environ["DEEPEVAL_CONFIDENT_AI_OPT_OUT"] = "YES"
os.environ.pop("CONFIDENT_API_KEY", None)

# Ensure project root and evals are in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
