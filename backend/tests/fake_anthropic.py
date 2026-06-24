"""A scriptable fake Anthropic client for tests — no network calls.

Build a list of scripted turns (text or tool_use) and install it over
``claude_client.create_anthropic_client``. The fake records every ``create`` and
``count_tokens`` call for assertions.
"""

import claude_client


class _Block:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def text_block(text):
    return _Block(type="text", text=text)


def tool_use_block(name, tool_input, block_id="toolu_1"):
    return _Block(type="tool_use", id=block_id, name=name, input=tool_input)


class _Response:
    def __init__(self, stop_reason, content):
        self.stop_reason = stop_reason
        self.content = content


def text_turn(text):
    return _Response("end_turn", [text_block(text)])


def tool_turn(calls, text=None):
    """calls: list of (name, input[, id]) tuples."""
    content = []
    if text:
        content.append(text_block(text))
    for i, call in enumerate(calls):
        name, tool_input = call[0], call[1]
        bid = call[2] if len(call) > 2 else f"toolu_{i}"
        content.append(tool_use_block(name, tool_input, bid))
    return _Response("tool_use", content)


class _Messages:
    def __init__(self, fake):
        self._fake = fake

    def create(self, **kwargs):
        self._fake.create_calls.append(kwargs)
        if self._fake.raise_on_create is not None:
            raise self._fake.raise_on_create
        turn = self._fake.turns[self._fake._i]
        self._fake._i += 1
        return turn

    def count_tokens(self, **kwargs):
        self._fake.count_calls.append(kwargs)
        return _Block(input_tokens=self._fake._token_fn(kwargs))


class FakeAnthropic:
    def __init__(self, turns=None, token_fn=None, raise_on_create=None):
        self.turns = turns or []
        self._i = 0
        self.create_calls = []
        self.count_calls = []
        self.raise_on_create = raise_on_create
        self._token_fn = token_fn or (lambda kw: 100)
        self.messages = _Messages(self)


def install(monkeypatch, fake):
    monkeypatch.setattr(claude_client, "create_anthropic_client", lambda: fake)
    return fake
