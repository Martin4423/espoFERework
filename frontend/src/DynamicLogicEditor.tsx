import { useState } from "react";
import { Plus, Trash2 } from "./Icons";
import type { Metadata } from "./api";
import SelectRecordsDialog from "./SelectRecordsDialog";

type Row = Record<string, any>;
type Node = { type: string; attribute?: string; value?: any; data?: Row };
type Group = { type: "and" | "or" | "not"; value: Node[] };

const operatorLabels: Record<string, string> = {
  isTrue: "je zapnuto", isFalse: "je vypnuto", equals: "se rovná", notEquals: "se nerovná",
  isEmpty: "je prázdné", isNotEmpty: "není prázdné", greaterThan: "je větší než", lessThan: "je menší než",
  greaterThanOrEquals: "je větší nebo rovno", lessThanOrEquals: "je menší nebo rovno", in: "je jedna z hodnot",
  notIn: "není žádná z hodnot", has: "obsahuje", notHas: "neobsahuje", contains: "obsahuje záznam",
  notContains: "neobsahuje záznam", startsWith: "začíná na", endsWith: "končí na", matches: "odpovídá výrazu",
  isToday: "je dnes", inFuture: "je v budoucnu", inPast: "je v minulosti",
};
const noValueOperators = new Set(["isTrue", "isFalse", "isEmpty", "isNotEmpty", "isToday", "inFuture", "inPast"]);

function normalizedGroup(value: any): Group {
  const list = Array.isArray(value?.conditionGroup) ? value.conditionGroup : [];
  if (list.length === 1 && ["and", "or", "not"].includes(list[0]?.type) && Array.isArray(list[0]?.value)) {
    return { type: list[0].type, value: list[0].value };
  }
  return { type: "and", value: list };
}

function toValue(group: Group, original: any): any {
  if (!group.value.length) return null;
  const base = original && typeof original === "object" ? { ...original } : {};
  base.conditionGroup = [{ type: group.type, value: group.value }];
  return base;
}

export function DynamicLogicEditor({
  metadata, entity, value, onChange, title,
}: { metadata: Metadata; entity: string; value: any; onChange: (value: any) => void; title: string }) {
  const [picker, setPicker] = useState<{ path: number[]; index: number; attribute: string; entity: string } | null>(null);
  const logicDefs = metadata.clientDefs?.DynamicLogic || {};
  const entityFields = metadata.entityDefs?.[entity]?.fields || {};
  const fields = Object.keys(entityFields).filter((name) => !entityFields[name].disabled && !entityFields[name].utility).map((name) => ({ name, type: entityFields[name].type || "varchar", label: metadata.labels?.[entity]?.fields?.[name] || name }));
  fields.push({ name: "id", type: "id", label: "ID záznamu" });
  fields.push({ name: "$user.id", type: "currentUser", label: "Aktuální uživatel" });
  fields.push({ name: "$user.teamsIds", type: "currentUserTeams", label: "Týmy aktuálního uživatele" });
  const fieldNameFromAttribute = (attribute: string) => attribute.endsWith("Ids") ? attribute.slice(0, -3) : attribute.endsWith("Id") ? attribute.slice(0, -2) : attribute;
  const fieldType = (attribute: string) => fields.find((field) => field.name === attribute)?.type || entityFields[fieldNameFromAttribute(attribute)]?.type || "varchar";
  const fieldDef = (attribute: string) => entityFields[attribute] || entityFields[fieldNameFromAttribute(attribute)] || {};
  const typeChoices = (attribute: string) => logicDefs.fieldTypes?.[fieldType(attribute)]?.typeList || ["equals", "notEquals", "isEmpty", "isNotEmpty"];
  const targetEntity = (attribute: string) => {
    const type = fieldType(attribute);
    if (type === "currentUser") return "User";
    if (type === "currentUserTeams") return "Team";
    const name = type === "currentUserTeams" ? "teams" : fieldNameFromAttribute(attribute);
    return fieldDef(name).entity || metadata.entityDefs?.[entity]?.links?.[name]?.entity || "";
  };
  const update = (group: Group) => onChange(toValue(group, value));
  const root = normalizedGroup(value);

  function addNode(path: number[], node: Node) {
    const next = [...root.value];
    if (!path.length) next.push(node);
    else {
      const setAt = (list: Node[], remaining: number[]): Node[] => list.map((item, index) => {
        if (index !== remaining[0] || !["and", "or", "not"].includes(item.type) || !Array.isArray(item.value)) return item;
        const children = remaining.length === 1 ? [...item.value, node] : setAt(item.value, remaining.slice(1));
        return { ...item, value: children };
      });
      next.splice(0, next.length, ...setAt(next, path));
    }
    update({ ...root, value: next });
  }
  function replaceNode(path: number[], nodeIndex: number, nextNode: Node | null) {
    const edit = (list: Node[], remaining: number[]): Node[] => {
      if (!remaining.length) return list.flatMap((node, index) => index === nodeIndex ? nextNode ? [nextNode] : [] : [node]);
      return list.map((node, index) => index !== remaining[0] || !Array.isArray(node.value) ? node : { ...node, value: edit(node.value, remaining.slice(1)) });
    };
    update({ ...root, value: edit(root.value, path) });
  }
  function chooseRecord(row: Row) {
    if (!picker) return;
    const attribute = picker.attribute;
    const type = fieldType(attribute);
    if (type === "currentUser") {
      replaceNode(picker.path, picker.index, { type: findNode(root.value, picker.path, picker.index)?.type || "equals", attribute: "$user.id", value: row.id, data: { values: { name: row.name || row.userName || row.id } } });
    } else {
      const name = type === "currentUserTeams" ? "teams" : fieldNameFromAttribute(attribute);
      const original = findNode(root.value, picker.path, picker.index);
      const next = original ? { ...original, value: row.id } : null;
      if (next) {
        next.attribute = type === "currentUserTeams" ? "$user.teamsIds" : type === "linkMultiple" ? `${name}Ids` : `${name}Id`;
        next.data = type === "currentUserTeams"
          ? { ...(next.data || {}), field: "teams", values: { ...(next.data?.values || {}), linkName: row.name || row.id, linkId: row.id } }
          : type === "linkMultiple"
            ? { ...(next.data || {}), field: name, values: { ...(next.data?.values || {}), linkName: row.name || row.id, linkId: row.id } }
            : { ...(next.data || {}), field: name, values: { ...(next.data?.values || {}), [`${name}Name`]: row.name || row.id } };
      }
      replaceNode(picker.path, picker.index, next);
    }
    setPicker(null);
  }
  function findNode(list: Node[], path: number[], index: number): Node | null {
    let current = list;
    for (const part of path) {
      const node = current[part];
      if (!node || !Array.isArray(node.value)) return null;
      current = node.value;
    }
    return current[index] || null;
  }
  function renderNode(node: Node, index: number, parentPath: number[]) {
    const path = [...parentPath, index];
    if (["and", "or", "not"].includes(node.type) && Array.isArray(node.value)) {
      return <div className="logic-condition-group nested" key={path.join("-")}><div className="logic-group-toolbar"><select aria-label="Logika skupiny" value={node.type} onChange={(event) => replaceNode(parentPath, index, { ...node, type: event.target.value })}><option value="and">Všechny podmínky (AND)</option><option value="or">Libovolná podmínka (OR)</option><option value="not">Žádná podmínka (NOT)</option></select><button type="button" className="icon-button" title="Odebrat skupinu" onClick={() => replaceNode(parentPath, index, null)}><Trash2 size={13}/></button></div><div className="logic-group-children">{node.value.map((child: Node, childIndex: number) => renderNode(child, childIndex, path))}</div><div className="logic-add-row"><button type="button" className="button subtle" onClick={() => addNode(path, { type: "equals", attribute: fields[0]?.name || "name", value: "" })}><Plus size={12}/> Podmínku</button><button type="button" className="button subtle" onClick={() => addNode(path, { type: "and", value: [] })}><Plus size={12}/> Skupinu</button></div></div>;
    }
    const type = fieldType(node.attribute || "");
    const selectedAttribute = (node.attribute || "").startsWith("$user.") ? node.attribute || "" : node.data?.field || fieldNameFromAttribute(node.attribute || "");
    const fieldOptions = fieldDef(node.attribute || "").options || [];
    const optionLabels = (metadata.labels as any)?.[entity]?.options?.[fieldNameFromAttribute(node.attribute || "")] || {};
    const hasValue = !noValueOperators.has(node.type);
    const multiValue = ["in", "notIn"].includes(node.type);
    const selectableEntity = hasValue ? targetEntity(node.attribute || "") : "";
    const linkedName = type === "currentUser" ? node.data?.values?.name : type === "linkMultiple" || type === "currentUserTeams" ? node.data?.values?.linkName : node.data?.values?.[`${fieldNameFromAttribute(node.attribute || "")}Name`];
    const valueControl = selectableEntity
      ? <button type="button" className="button subtle logic-record-value" onClick={() => setPicker({ path: parentPath, index, attribute: node.attribute || "", entity: selectableEntity })}>{linkedName || (node.value ? String(node.value) : "Vybrat záznam…")}</button>
      : fieldOptions.length > 0 && ["enum", "enumInt", "multiEnum", "checklist", "array"].includes(type)
        ? <select aria-label="Hodnota podmínky" multiple={multiValue} value={multiValue ? Array.isArray(node.value) ? node.value.map(String) : [] : String(node.value ?? "")} onChange={(event) => { const value = multiValue ? Array.from(event.target.selectedOptions).map((option) => option.value) : event.target.value; replaceNode(parentPath, index, { ...node, value }); }}>{fieldOptions.map((option: string | number) => <option key={option} value={String(option)}>{optionLabels[String(option)] || String(option)}</option>)}</select>
        : <input aria-label="Hodnota podmínky" type={type === "date" ? "date" : ["int", "float", "currency"].includes(type) ? "number" : "text"} value={Array.isArray(node.value) ? node.value.join(", ") : node.value ?? ""} placeholder="Hodnota" onChange={(event) => replaceNode(parentPath, index, { ...node, value: ["int", "float", "currency"].includes(type) && event.target.value !== "" ? Number(event.target.value) : event.target.value })}/>;
    return <div className="logic-condition-row" key={path.join("-")}><select aria-label="Pole podmínky" value={selectedAttribute} onChange={(event) => { const attribute = event.target.value; const operator = typeChoices(attribute)[0] || "equals"; replaceNode(parentPath, index, { ...node, attribute, type: operator, value: "", data: undefined }); }}><option value="">Vyberte pole…</option>{fields.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}</select><select aria-label="Operátor" value={node.type} onChange={(event) => replaceNode(parentPath, index, { ...node, type: event.target.value, value: noValueOperators.has(event.target.value) ? undefined : node.value ?? "" })}>{typeChoices(node.attribute || "name").map((operator: string) => <option key={operator} value={operator}>{operatorLabels[operator] || operator}</option>)}</select>{hasValue && valueControl}<button type="button" className="icon-button" title="Odebrat podmínku" onClick={() => replaceNode(parentPath, index, null)}><Trash2 size={13}/></button></div>;
  }

  return <><section className="dynamic-logic-editor"><div className="dynamic-logic-heading"><div><strong>{title}</strong><small>Pravidla se ukládají do nativní definice logicDefs ViaCRM.</small></div>{value && <button type="button" className="button subtle" onClick={() => onChange(null)}>Vypnout</button>}</div>{value && title.includes("Validační") && <label className="setting-field logic-validation-message"><span>Chybová zpráva</span><input value={value.message || ""} onChange={(event) => onChange({ ...value, message: event.target.value })} placeholder="Vlastní text chyby (volitelné)"/></label>}{!value ? <button type="button" className="button subtle" onClick={() => onChange({ conditionGroup: [{ type: "and", value: [{ type: "isNotEmpty", attribute: fields[0]?.name || "name" }] }] })}><Plus size={13}/> Přidat pravidlo</button> : <><div className="logic-root-operator"><span>Platí, když</span><select value={root.type} onChange={(event) => update({ ...root, type: event.target.value as Group["type"] })}><option value="and">platí všechny podmínky</option><option value="or">platí některá podmínka</option><option value="not">neplatí žádná podmínka</option></select></div><div className="logic-group-children">{root.value.map((node, index) => renderNode(node, index, []))}</div><div className="logic-add-row"><button type="button" className="button subtle" onClick={() => addNode([], { type: "equals", attribute: fields[0]?.name || "name", value: "" })}><Plus size={12}/> Podmínku</button><button type="button" className="button subtle" onClick={() => addNode([], { type: "and", value: [] })}><Plus size={12}/> Skupinu</button></div></>}</section>{picker && <SelectRecordsDialog entity={picker.entity} metadata={metadata} multiple={false} selectedIds={findNode(root.value, picker.path, picker.index)?.value ? [String(findNode(root.value, picker.path, picker.index)?.value)] : []} selectedRows={(() => { const node = findNode(root.value, picker.path, picker.index); const name = fieldType(picker.attribute) === "currentUser" ? node?.data?.values?.name : fieldType(picker.attribute) === "linkMultiple" || fieldType(picker.attribute) === "currentUserTeams" ? node?.data?.values?.linkName : node?.data?.values?.[`${fieldNameFromAttribute(picker.attribute)}Name`]; return node?.value ? [{ id: String(node.value), name: String(name || node.value) }] : []; })()} onClose={() => setPicker(null)} onSelect={(rows) => { if (rows[0]) chooseRecord(rows[0]); else setPicker(null); }}/>}</>;
}
