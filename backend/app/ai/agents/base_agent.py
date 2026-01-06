"""Base agent class for specialized ML evaluation agents using LangChain."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.core.config import Settings


class AgentResponse(BaseModel):
    """Base response model for agents."""

    summary: str
    confidence: float  # 0.0 to 1.0
    findings: list[str]
    recommendations: list[str]
    requires_further_analysis: bool = False


class BaseAgent(ABC):
    """Base class for specialized evaluation agents."""

    def __init__(self, settings: Settings, agent_name: str, system_prompt: str):
        self.settings = settings
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.llm = ChatOpenAI(
            model=settings.openai_model,
            temperature=0.1,  # Low temperature for consistent analysis
            api_key=settings.openai_api_key,
            base_url=str(settings.openai_api_base) if settings.openai_api_base else None,
        )
        self.parser = PydanticOutputParser(pydantic_object=AgentResponse)

    @abstractmethod
    def analyze(self, context: dict[str, Any]) -> AgentResponse:
        """Analyze the provided context and return structured findings."""
        pass

    def _invoke_llm(self, user_prompt: str) -> AgentResponse:
        """Invoke LLM with structured output parsing."""
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(
                content=f"{user_prompt}\n\n{self.parser.get_format_instructions()}"
            ),
        ]
        response = self.llm.invoke(messages)
        return self.parser.parse(response.content)

