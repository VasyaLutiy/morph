"""The one shared helpers module of {{name}}: fixtures, temporary trees and the network block.

Every test takes its stubs from here and never writes its own. Temporary trees come from pytest's tmp_path.
"""
import json
import pathlib
import socket

import pytest

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"


def fixture_path(name: str) -> pathlib.Path:
    return FIXTURES / name


def fixture_text(name: str) -> str:
    return fixture_path(name).read_text(encoding="utf-8")


def fixture_json(name: str) -> object:
    return json.loads(fixture_text(name))


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def blocked(*args: object, **kwargs: object) -> None:
        raise RuntimeError("network blocked in tests")

    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)
