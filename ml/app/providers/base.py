"""Provider interfaces. The pipeline only ever talks to these; concrete local
and cloud implementations live beside them and are picked by providers.yaml."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal, Optional

from pydantic import BaseModel

Side = Literal["me", "them"]
Role = Literal["parser", "llm", "embedder", "imagegen"]


class ParsedMessage(BaseModel):
    side: Side
    text: str
    time: Optional[str] = None
    reactions: list[str] = []
    attachment_type: Optional[str] = None


class ParsedScreenshot(BaseModel):
    source_app: Optional[str] = None
    messages: list[ParsedMessage]


class GeneratedImage(BaseModel):
    mime_type: str
    data: bytes
    provenance: Literal["imagined"] = "imagined"


class Provider(ABC):
    role: Role
    name: str
    # True if this provider sends data off the machine. Drives the cloud
    # opt-in disclosure shown to the user.
    is_cloud: bool = False
    # What leaves the machine, and to whom, when is_cloud is True.
    data_sent: list[str] = []
    recipient: Optional[str] = None

    def __init__(self, config: dict | None = None) -> None:
        self.config = config or {}

    def describe(self) -> dict:
        return {
            "role": self.role,
            "name": self.name,
            "is_cloud": self.is_cloud,
            "data_sent": self.data_sent,
            "recipient": self.recipient,
            "config": {k: v for k, v in self.config.items() if "key" not in k.lower()},
        }


class Parser(Provider):
    role: Role = "parser"

    @abstractmethod
    def parse(self, image: bytes, source_app: Optional[str] = None) -> ParsedScreenshot: ...


class LLM(Provider):
    role: Role = "llm"

    @abstractmethod
    def complete_json(self, system: str, prompt: str, schema: dict) -> dict:
        """Return a JSON object matching `schema`."""


class Embedder(Provider):
    role: Role = "embedder"
    dim: int

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class ImageGen(Provider):
    role: Role = "imagegen"

    @abstractmethod
    def generate(self, prompt: str, width: int, height: int, style_reference: bytes | None = None) -> GeneratedImage:
        """Art only. Text is never baked into generated images."""


class NotYetImplemented(NotImplementedError):
    def __init__(self, provider: str, milestone: str) -> None:
        super().__init__(f"{provider} is wired up but lands in {milestone}")
