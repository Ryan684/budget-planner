"""Anthropic client wrapper: system prompt, the manual tool-use loop, context
trimming, and error mapping.

Claude is called only from here (Constitution Principle IV). The loop is manual
(not the SDK tool runner) so every tool call is intercepted: writes are confined
to the current month, executed inside one transaction, and the whole turn is
rolled back by the caller if any tool fails (FR-015). Responses are returned in a
single turn — there is no streaming (MVP decision).
"""

import json
from dataclasses import dataclass

import anthropic
import claude_context
import claude_tools
from config import settings
from schemas import ClaudeRequest
from sqlalchemy.orm import Session

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
MAX_TOOL_ITERATIONS = 8
# Conservative ceiling; well under the model's 1M context. Only the conversation
# is trimmed when exceeded — the financial context is never dropped.
MAX_INPUT_TOKENS = 150_000

_SYSTEM_PROMPT = """You are a helpful family budget assistant. You have access to the
household's full financial history below (all months, plus account balances and
their changes) and can read it for analysis and forecasting. You can write
directly to the current month using the tools available to you.

Rules:
- Always state what you are about to do and its effect on surplus or account
  balances BEFORE executing any write.
- Tag every write with a clear reason.
- Never invent or approximate figures not present in the data. If a record does
  not exist, say so rather than estimating.
- When an answer relies on an account balance, include that balance's as-of date,
  and flag when the balance is marked stale (is_stale=true).
- If you are about to change a balance that is stale (is_stale=true), say so and
  include its as-of date in your statement before writing.
- If an instruction is ambiguous (e.g. multiple matching bills), ask for
  clarification before writing.
- You can only write to the current month. Previous months are read-only — if
  asked to change one, explain that you cannot.
- For comparison or trend questions, use the figures across months in the data.
  If there is no previous month to compare against, say so plainly rather than
  erroring.
- Be concise — the user is on a phone.

Financial data (all months and accounts):
{budget_json}
"""


class AssistantUnavailable(Exception):
    """The Anthropic API could not be reached or returned an error."""


@dataclass
class TurnResult:
    reply: str
    had_write_error: bool


def create_anthropic_client() -> anthropic.Anthropic:
    """Construct the SDK client. Patched in tests. Raises if no key configured."""
    if not settings.anthropic_api_key:
        raise AssistantUnavailable("No Anthropic API key is configured.")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def build_system_prompt(context: dict) -> str:
    return _SYSTEM_PROMPT.format(budget_json=json.dumps(context, sort_keys=True, default=str))


def _extract_text(response) -> str:
    parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    return "\n".join(parts).strip()


def _trim_conversation(client, system: str, messages: list[dict]) -> list[dict]:
    """Drop oldest conversation messages until the payload fits. Keeps at least
    the final (current) user message; never touches the financial context."""
    while len(messages) > 1:
        try:
            count = client.messages.count_tokens(
                model=MODEL, system=system, messages=messages, tools=claude_tools.TOOLS
            ).input_tokens
        except Exception:
            break
        if count <= MAX_INPUT_TOKENS:
            break
        messages.pop(0)
    return messages


def run_turn(session: Session, request: ClaudeRequest) -> TurnResult:
    """Run one Claude turn against the current budget. Executes any tool writes
    inside the caller's transaction (no commit here). Raises AssistantUnavailable
    if the API is unreachable/errors."""
    context = claude_context.build_budget_context(session)
    current_month_id = context["current_month_id"]
    system = build_system_prompt(context)

    messages: list[dict] = [{"role": m.role, "content": m.content} for m in request.conversation]
    messages.append({"role": "user", "content": request.message})

    client = create_anthropic_client()
    messages = _trim_conversation(client, system, messages)

    had_write_error = False
    for _ in range(MAX_TOOL_ITERATIONS):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                tools=claude_tools.TOOLS,
            )
        except anthropic.AnthropicError as exc:  # connection, timeout, status, etc.
            raise AssistantUnavailable(str(exc)) from exc

        if response.stop_reason != "tool_use":
            return TurnResult(reply=_extract_text(response), had_write_error=had_write_error)

        # Echo the assistant turn (including tool_use blocks) back, then answer
        # each tool_use with a tool_result.
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            try:
                result_text = claude_tools.dispatch(
                    session, current_month_id, block.name, dict(block.input)
                )
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": result_text}
                )
            except claude_tools.ToolDispatchError as exc:
                had_write_error = True
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(exc),
                        "is_error": True,
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    # Exhausted the tool-iteration budget without a final answer.
    return TurnResult(
        reply="I wasn't able to finish that request — please try rephrasing it.",
        had_write_error=had_write_error,
    )
