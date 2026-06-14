"""Generic create/update/delete with append-only amendment logging.

Every write goes through one of these helpers so that the amendment log is
written atomically with the mutation — there is no path that mutates an entity
without recording it. ``source`` and ``reason`` are parameters so that the
Phase 3 Claude integration reuses this exact code with ``source="claude"``.

entity_type is one of: "bill", "income", "account_balance".
"""

from typing import Any

import models
from sqlalchemy.orm import Session


def _stringify(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _entity_summary(entity) -> str:
    """Human-readable summary for amendment log lifecycle (created/deleted) entries."""
    label = getattr(entity, "label", None) or f"#{entity.id}"
    amount = getattr(entity, "amount", None)
    balance = getattr(entity, "balance", None)
    value = amount if amount is not None else balance
    if value is not None:
        return f"{label} (£{value:.2f})"
    return label


def _log(
    session: Session,
    *,
    entity_type: str,
    entity_id: int,
    entity_label: str | None,
    field_changed: str,
    old_value: Any,
    new_value: Any,
    month_id: int | None,
    source: str,
    reason: str | None,
) -> None:
    session.add(
        models.Amendment(
            month_id=month_id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            field_changed=field_changed,
            old_value=_stringify(old_value),
            new_value=_stringify(new_value),
            reason=reason,
            source=source,
        )
    )


def create_entity(
    session: Session,
    entity,
    *,
    entity_type: str,
    month_id: int | None,
    source: str = "user",
    reason: str | None = None,
):
    """Persist a new entity and log a 'created' amendment."""
    session.add(entity)
    session.flush()  # assign primary key
    _log(
        session,
        entity_type=entity_type,
        entity_id=entity.id,
        entity_label=getattr(entity, "label", None),
        field_changed="created",
        old_value=None,
        new_value=_entity_summary(entity),
        month_id=month_id,
        source=source,
        reason=reason,
    )
    session.commit()
    session.refresh(entity)
    return entity


def update_entity(
    session: Session,
    entity,
    changes: dict[str, Any],
    *,
    entity_type: str,
    month_id: int | None,
    source: str = "user",
    reason: str | None = None,
):
    """Apply field changes, logging one amendment per actually-changed field."""
    changed_any = False
    for field, new_value in changes.items():
        if new_value is None:
            continue
        old_value = getattr(entity, field)
        if old_value == new_value:
            continue
        setattr(entity, field, new_value)
        _log(
            session,
            entity_type=entity_type,
            entity_id=entity.id,
            entity_label=getattr(entity, "label", None),
            field_changed=field,
            old_value=old_value,
            new_value=new_value,
            month_id=month_id,
            source=source,
            reason=reason,
        )
        changed_any = True

    if changed_any:
        session.commit()
        session.refresh(entity)
    return entity


def delete_entity(
    session: Session,
    entity,
    *,
    entity_type: str,
    month_id: int | None,
    source: str = "user",
    reason: str | None = None,
) -> None:
    """Log a 'deleted' amendment (preserving entity_id) then delete the row."""
    entity_id = entity.id
    _log(
        session,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=getattr(entity, "label", None),
        field_changed="deleted",
        old_value=_entity_summary(entity),
        new_value=None,
        month_id=month_id,
        source=source,
        reason=reason,
    )
    session.delete(entity)
    session.commit()
