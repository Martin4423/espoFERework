import { Plus, Trash2 } from "./Icons";
import type { Metadata } from "./api";

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
  const logicDefs = metadata.clientDefs?.DynamicLogic || {};
  const entityFields = metadata.entityDefs?.[entity]?.fields || {};
  const fields = Object.keys(entityFields).filter((name) => !entityFields[name].disabled && !entityFields[name].utility).map((name) => ({ name, type: entityFields[name].type || "varchar", label: metadata.labels?.[entity]?.fields?.[name] || name }));
  fields.push({ name: "id", type: "id", label: "ID záznamu" });
  fields.push({ name: "currentUser", type: "currentUser", label: "Aktuální uživatel" });
  fields.push({ name: "currentUserTeams", type: "currentUserTeams", label: "Týmy aktuálního uživatele" });
  const fieldType = (attribute: string) => fields.find((field) => field.name === attribute)?.type || "varchar";
  const fieldDef = (attribute: string) => entityFields[attribute] || {};
  const typeChoices = (attribute: string) => logicDefs.fieldTypes?.[fieldType(attribute)]?.typeList || ["equals", "notEquals", "isEmpty", "isNotEmpty"];
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
  function renderNode(node: Node, index: number, parentPath: number[]) {
    const path = [...parentPath, index];
    if (["and", "or", "not"].includes(node.type) && Array.isArray(node.value)) {
      return <div className="logic-condition-group nested" key={path.join("-")}><div className="logic-group-toolbar"><select aria-label="Logika skupiny" value={node.type} onChange={(event) => replaceNode(parentPath, index, { ...node, type: event.target.value })}><option value="and">Všechny podmínky (AND)</option><option value="or">Libovolná podmínka (OR)</option><option value="not">Žádná podmínka (NOT)</option></select><button type="button" className="icon-button" title="Odebrat skupinu" onClick={() => replaceNode(parentPath, index, null)}><Trash2 size={13}/></button></div><div className="logic-group-children">{node.value.map((child: Node, childIndex: number) => renderNode(child, childIndex, path))}</div><div className="logic-add-row"><button type="button" className="button subtle" onClick={() => addNode(path, { type: "equals", attribute: fields[0]?.name || "name", value: "" })}><Plus size={12}/> Podmínku</button><button type="button" className="button subtle" onClick={() => addNode(path, { type: "and", value: [] })}><Plus size={12}/> Skupinu</button></div></div>;
    }
    const type = fieldType(node.attribute || "");
    const fieldOptions = fieldDef(node.attribute || "").options || [];
    const hasValue = !noValueOperators.has(node.type);
    const multiValue = ["in", "notIn"].includes(node.type);
    return <div className="logic-condition-row" key={path.join("-")}><select aria-label="Pole podmínky" value={node.attribute || ""} onChange={(event) => { const attribute = event.target.value; const operator = typeChoices(attribute)[0] || "equals"; replaceNode(parentPath, index, { ...node, attribute, type: operator, value: "" }); }}><option value="">Vyberte pole…</option>{fields.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}</select><select aria-label="Operátor" value={node.type} onChange={(event) => replaceNode(parentPath, index, { ...node, type: event.target.value, value: noValueOperators.has(event.target.value) ? undefined : node.value ?? "" })}>{typeChoices(node.attribute || "name").map((operator: string) => <option key={operator} value={operator}>{operatorLabels[operator] || operator}</option>)}</select>{hasValue && (fieldOptions.length > 0 && ["enum", "enumInt", "multiEnum", "checklist", "array"].includes(type) ? <select aria-label="Hodnota podmínky" multiple={multiValue} value={multiValue ? Array.isArray(node.value) ? node.value.map(String) : [] : String(node.value ?? "")} onChange={(event) => { const value = multiValue ? Array.from(event.target.selectedOptions).map((option) => option.value) : event.target.value; replaceNode(parentPath, index, { ...node, value }); }}>{fieldOptions.map((option: string | number) => <option key={option} value={String(option)}>{String(option)}</option>)}</select> : <input aria-label="Hodnota podmínky" type={type === "date" ? "date" : ["int", "float", "currency"].includes(type) ? "number" : "text"} value={Array.isArray(node.value) ? node.value.join(", ") : node.value ?? ""} placeholder={type === "link" || type === "linkOne" ? "ID souvisejícího záznamu" : "Hodnota"} onChange={(event) => replaceNode(parentPath, index, { ...node, value: ["int", "float", "currency"].includes(type) && event.target.value !== "" ? Number(event.target.value) : event.target.value })}/>) }<button type="button" className="icon-button" title="Odebrat podmínku" onClick={() => replaceNode(parentPath, index, null)}><Trash2 size={13}/></button></div>;
  }

  return <section className="dynamic-logic-editor"><div className="dynamic-logic-heading"><div><strong>{title}</strong><small>Pravidla se ukládají do nativní definice logicDefs EspoCRM.</small></div>{value && <button type="button" className="button subtle" onClick={() => onChange(null)}>Vypnout</button>}</div>{value && title.includes("Validační") && <label className="setting-field logic-validation-message"><span>Chybová zpráva</span><input value={value.message || ""} onChange={(event) => onChange({ ...value, message: event.target.value })} placeholder="Vlastní text chyby (volitelné)"/></label>}{!value ? <button type="button" className="button subtle" onClick={() => onChange({ conditionGroup: [{ type: "and", value: [{ type: "isNotEmpty", attribute: fields[0]?.name || "name" }] }] })}><Plus size={13}/> Přidat pravidlo</button> : <><div className="logic-root-operator"><span>Platí, když</span><select value={root.type} onChange={(event) => update({ ...root, type: event.target.value as Group["type"] })}><option value="and">platí všechny podmínky</option><option value="or">platí některá podmínka</option><option value="not">neplatí žádná podmínka</option></select></div><div className="logic-group-children">{root.value.map((node, index) => renderNode(node, index, []))}</div><div className="logic-add-row"><button type="button" className="button subtle" onClick={() => addNode([], { type: "equals", attribute: fields[0]?.name || "name", value: "" })}><Plus size={12}/> Podmínku</button><button type="button" className="button subtle" onClick={() => addNode([], { type: "and", value: [] })}><Plus size={12}/> Skupinu</button></div></>}</section>;
}

export function DynamicOptionsEditor({ metadata, entity, options, value, onChange }: { metadata: Metadata; entity: string; options: Array<string | number>; value: any[]; onChange: (value: any[]) => void }) {
  const list = Array.isArray(value) ? value : [];
  return <section className="dynamic-logic-editor dynamic-options-editor"><div className="dynamic-logic-heading"><div><strong>Dynamické možnosti</strong><small>Vybrané možnosti se zobrazí jen při splnění podmínky.</small></div><button type="button" className="button subtle" onClick={() => onChange([...list, { optionList: [], conditionGroup: [{ type: "and", value: [] }] }])}><Plus size={12}/> Pravidlo</button></div>{list.map((item, index) => <div className="dynamic-option-rule" key={index}><label><span>Možnosti</span><select multiple value={(item.optionList || []).map(String)} onChange={(event) => { const next = [...list]; next[index] = { ...item, optionList: Array.from(event.target.selectedOptions).map((option) => option.value) }; onChange(next); }}>{options.map((option) => <option key={option} value={String(option)}>{String(option)}</option>)}</select></label><DynamicLogicEditor metadata={metadata} entity={entity} value={{ conditionGroup: item.conditionGroup || [] }} title="Podmínka" onChange={(next) => { const updated = [...list]; updated[index] = { ...item, conditionGroup: next?.conditionGroup || [] }; onChange(updated); }}/><button type="button" className="button danger" onClick={() => onChange(list.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={12}/> Odebrat pravidlo</button></div>)}</section>;
}
