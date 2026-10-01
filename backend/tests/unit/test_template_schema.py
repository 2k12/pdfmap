"""RF-13 (plantillas válidas) y RNF-03 (validación estricta de la entrada)."""

import copy

import pytest
from pydantic import ValidationError

from app.schemas import Template

pytestmark = [pytest.mark.req("RF-13"), pytest.mark.req("RNF-03")]


def test_builtin_and_fixture_templates_are_valid(builtin_template, ventas_template):
    assert Template.model_validate(builtin_template).id == "builtin-ventas-ejemplo"
    tpl = Template.model_validate(ventas_template)
    assert tpl.options.sheet_name == "Ventas"
    assert tpl.rules[2].fields[0].type == "date"


def _mutate(base: dict, fn) -> dict:
    data = copy.deepcopy(base)
    fn(data)
    return data


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda t: t["rules"].append(copy.deepcopy(t["rules"][1])), "id duplicado"),
        (lambda t: t["rules"][1]["match"].update(value="(sin cerrar"), "Regex inválida"),
        (lambda t: t["columns"][0].update(sources=["nadie.nada"]), "fuente desconocida"),
        (lambda t: t["rules"][1]["fields"][0].update(group="noexiste"), "no existe en la regex"),
        (lambda t: t["rules"][2]["fields"][0].update(start=10, end=5), "end debe ser mayor"),
        (lambda t: t["rules"][2]["fields"].append({"key": "fecha"}), "campos duplicados"),
        (lambda t: t["rules"][4].update(check=None), "requiere 'check'"),
        (lambda t: t["rules"][4]["check"]["compare"][0].update(sum_of="zzz"), "columna inexistente"),
        (lambda t: t["rules"][4]["check"]["compare"][0].update(field="zzz"), "de check no existe"),
        (lambda t: t["rules"][4]["check"].update(group="zzz"), "grupo de check inexistente"),
        (lambda t: t["rules"][1].update(clears=["zzz"]), "regla inexistente"),
        (lambda t: t["options"].update(sheet_name="a/b"), "nombre de hoja"),
        (lambda t: t["columns"].append(copy.deepcopy(t["columns"][0])), "columnas con id duplicado"),
        (lambda t: t["rules"][1].update(id="Mayúsculas"), "pattern"),
        (lambda t: t["rules"][1].update(action="borrar"), "action"),
        (lambda t: t["rules"][1]["match"].update(type="contains", value=""), "no puede estar vacío"),
        (lambda t: t["rules"][1]["match"].update(value="a" * 1001), "at most 1000"),
        (lambda t: t.update(campo_extra=1), "Extra inputs"),
    ],
)
def test_invalid_templates_are_rejected(ventas_template, mutation, message):
    with pytest.raises(ValidationError) as exc:
        Template.model_validate(_mutate(ventas_template, mutation))
    assert message in str(exc.value)


def test_engine_dict_has_defaults(ventas_template):
    data = Template.model_validate(ventas_template).engine_dict()
    field = data["rules"][2]["fields"][1]
    assert field["type"] == "text" and field["trim"] is True and field["decimal"] == "."
    assert data["options"]["csv_delimiter"] == ";"
