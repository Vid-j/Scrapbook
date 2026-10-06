"""Concrete providers. Model calls arrive in later milestones; until then each
stub raises NotYetImplemented so the wiring and config can be exercised."""

from __future__ import annotations

from typing import Optional

from .base import LLM, Embedder, GeneratedImage, ImageGen, NotYetImplemented, ParsedScreenshot, Parser


# --- Parsers -----------------------------------------------------------------

class ClaudeVisionParser(Parser):
    name = "claude_vision"
    is_cloud = True
    data_sent = ["screenshots"]
    recipient = "Anthropic (Claude API)"

    def parse(self, image: bytes, source_app: Optional[str] = None) -> ParsedScreenshot:
        raise NotYetImplemented(self.name, "M2")


class PaddleOCRParser(Parser):
    name = "paddleocr"

    def parse(self, image: bytes, source_app: Optional[str] = None) -> ParsedScreenshot:
        raise NotYetImplemented(self.name, "M2")


# --- Language models ---------------------------------------------------------

class ClaudeLLM(LLM):
    name = "claude"
    is_cloud = True
    data_sent = ["message text"]
    recipient = "Anthropic (Claude API)"

    def complete_json(self, system: str, prompt: str, schema: dict) -> dict:
        raise NotYetImplemented(self.name, "M3")


class OllamaLLM(LLM):
    name = "ollama"

    def complete_json(self, system: str, prompt: str, schema: dict) -> dict:
        raise NotYetImplemented(self.name, "M3")


# --- Embedders ---------------------------------------------------------------

class SentenceTransformersEmbedder(Embedder):
    name = "sentence_transformers"
    dim = 384

    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotYetImplemented(self.name, "M3")


# --- Image generation --------------------------------------------------------

class ComfyUIImageGen(ImageGen):
    name = "comfyui"

    def generate(self, prompt: str, width: int, height: int, style_reference: bytes | None = None) -> GeneratedImage:
        raise NotYetImplemented(self.name, "M7")


class PlaceholderImageGen(ImageGen):
    """Used when no image model is configured: a plain kraft panel with a
    soft vignette. Original art, no text."""

    name = "placeholder"

    def generate(self, prompt: str, width: int, height: int, style_reference: bytes | None = None) -> GeneratedImage:
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
            '<defs><radialGradient id="v" cx="50%" cy="45%" r="70%">'
            '<stop offset="0" stop-color="#e6d3b0"/><stop offset="1" stop-color="#b98d5c"/>'
            "</radialGradient></defs>"
            f'<rect width="{width}" height="{height}" fill="url(#v)"/>'
            f'<circle cx="{width * 0.72}" cy="{height * 0.3}" r="{min(width, height) * 0.08}" fill="#8e1f1f" opacity=".35"/>'
            "</svg>"
        )
        return GeneratedImage(mime_type="image/svg+xml", data=svg.encode())


REGISTRY: dict[str, dict[str, type]] = {
    "parser": {c.name: c for c in (ClaudeVisionParser, PaddleOCRParser)},
    "llm": {c.name: c for c in (ClaudeLLM, OllamaLLM)},
    "embedder": {c.name: c for c in (SentenceTransformersEmbedder,)},
    "imagegen": {c.name: c for c in (ComfyUIImageGen, PlaceholderImageGen)},
}
