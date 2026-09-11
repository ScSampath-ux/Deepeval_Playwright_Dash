"""
ShipConsole AI Chatbot - AWS Bedrock Drivers

This module implements custom DeepEval wrappers for AWS Bedrock services:
  - BedrockLLM: DeepEvalBaseLLM wrapper for Anthropic Claude via ChatBedrockConverse.
  - BedrockEmbeddingModel: DeepEvalBaseEmbeddingModel wrapper for Amazon Titan Embeddings.
"""

from typing import Any, List
import os
from botocore.config import Config
from deepeval.models import DeepEvalBaseLLM, DeepEvalBaseEmbeddingModel
from langchain_aws import ChatBedrockConverse, BedrockEmbeddings

BOTO3_CONFIG = Config(
    read_timeout=300,
    connect_timeout=60,
    retries={"max_attempts": 5, "mode": "standard"}
)


def _clean_json_response(text: str) -> str:
    """
    Extracts valid JSON array or object substring from model output to ensure parsing robustness.
    """
    text = text.strip()
    start_brace = text.find('{')
    end_brace = text.rfind('}')
    start_bracket = text.find('[')
    end_bracket = text.rfind(']')

    has_brace = start_brace != -1 and end_brace != -1 and end_brace > start_brace
    has_bracket = start_bracket != -1 and end_bracket != -1 and end_bracket > start_bracket

    if has_brace and has_bracket:
        if start_brace < start_bracket:
            return text[start_brace:end_brace + 1]
        else:
            return text[start_bracket:end_bracket + 1]
    elif has_brace:
        return text[start_brace:end_brace + 1]
    elif has_bracket:
        return text[start_bracket:end_bracket + 1]

    return text


class BedrockLLM(DeepEvalBaseLLM):
    """
    Custom DeepEval LLM wrapper routing metric evaluations through AWS Bedrock (Claude).
    """

    def __init__(self, model_name: str = None, region_name: str = None):
        self.model_name = model_name or os.environ.get("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-5-20250929-v1:0")
        self.region_name = region_name or os.environ.get("AWS_REGION", "us-west-2")
        self.model = ChatBedrockConverse(
            model_id=self.model_name,
            region_name=self.region_name,
            credentials_profile_name=os.environ.get("AWS_PROFILE") or os.environ.get("AWS_USER"),
            temperature=0,
            config=BOTO3_CONFIG,
        )
        super().__init__(self.model_name)

    def load_model(self):
        return self.model

    def generate(self, prompt: str, *args, **kwargs) -> str:
        if "schema" in kwargs:
            raise TypeError("schema is not supported directly")
        try:
            content = self.model.invoke(prompt, *args, **kwargs).content
            cleaned = _clean_json_response(content)
            print(f"\n--- [BedrockLLM Generate] ---")
            print(f"Prompt preview: {prompt[:200]}...")
            print(f"Response: {content}")
            print(f"Cleaned: {cleaned}\n")
            return cleaned
        except Exception as e:
            print(f"\n[BedrockLLM Error] Failed to generate response: {e}")
            print(f"[BedrockLLM Prompt] {prompt[:500]}...")
            raise e

    async def a_generate(self, prompt: str, *args, **kwargs) -> str:
        if "schema" in kwargs:
            raise TypeError("schema is not supported directly")
        try:
            res = await self.model.ainvoke(prompt, *args, **kwargs)
            content = res.content
            cleaned = _clean_json_response(content)
            print(f"\n--- [BedrockLLM Async Generate] ---")
            print(f"Prompt preview: {prompt[:200]}...")
            print(f"Response: {content}")
            print(f"Cleaned: {cleaned}\n")
            return cleaned
        except Exception as e:
            print(f"\n[BedrockLLM Async Error] Failed to generate response: {e}")
            print(f"[BedrockLLM Prompt] {prompt[:500]}...")
            raise e

    def get_model_name(self) -> str:
        return self.model_name


class BedrockEmbeddingModel(DeepEvalBaseEmbeddingModel):
    """
    Custom DeepEval Embedding wrapper routing document embeddings through AWS Bedrock.
    """

    def __init__(self, model_name: str = "amazon.titan-embed-text-v1", region_name: str = None):
        self.model_name = model_name
        self.region_name = region_name or os.environ.get("AWS_REGION", "us-west-2")
        self.model = BedrockEmbeddings(
            model_id=self.model_name,
            region_name=self.region_name,
            credentials_profile_name=os.environ.get("AWS_PROFILE") or os.environ.get("AWS_USER"),
            config=BOTO3_CONFIG,
        )
        super().__init__(self.model_name)

    def load_model(self):
        return self.model

    def embed_text(self, text: str) -> List[float]:
        return self.model.embed_query(text)

    async def a_embed_text(self, text: str) -> List[float]:
        return await self.model.aembed_query(text)

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return self.model.embed_documents(texts)

    async def a_embed_texts(self, texts: List[str]) -> List[List[float]]:
        return await self.model.aembed_documents(texts)

    def get_model_name(self) -> str:
        return self.model_name
