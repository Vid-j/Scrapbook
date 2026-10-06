"""Loads providers.yaml and instantiates one provider per role."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

from .providers.base import LLM, Embedder, ImageGen, Parser
from .providers.implementations import REGISTRY

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = Path(os.environ.get("PROVIDERS_CONFIG", ROOT / "providers.yaml"))
DATA_DIR = Path(os.environ.get("SCRAPBOOK_DATA_DIR", ROOT / "data"))

ROLES = ("parser", "llm", "embedder", "imagegen")


@dataclass
class Providers:
    preset: str
    parser: Parser
    llm: LLM
    embedder: Embedder
    imagegen: ImageGen

    def all(self):
        return [self.parser, self.llm, self.embedder, self.imagegen]


def load_providers(path: Path = CONFIG_PATH) -> Providers:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    preset_name = os.environ.get("PROVIDERS_PRESET", raw.get("preset", "local"))
    presets = raw.get("presets", {})
    if preset_name not in presets:
        raise ValueError(f"Unknown provider preset '{preset_name}'")
    choice = {**presets[preset_name], **(raw.get("overrides") or {})}
    settings = raw.get("providers", {})

    built = {}
    for role in ROLES:
        name = choice.get(role)
        cls = REGISTRY[role].get(name)
        if cls is None:
            raise ValueError(f"Unknown {role} provider '{name}'. Options: {sorted(REGISTRY[role])}")
        built[role] = cls(settings.get(name) or {})
    return Providers(preset=preset_name, **built)
