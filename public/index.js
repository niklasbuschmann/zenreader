const equalFn = (a, b) => a === b;
let runEffects = runQueue;
const NOTPENDING = {};
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
const [transPending, setTransPending] = createSignal(false, true);
let Owner = null;
let Listener = null;
let Pending = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  detachedOwner && (Owner = detachedOwner);
  const listener = Listener,
        owner = Owner,
        root = fn.length === 0 ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: null,
    owner
  };
  Owner = root;
  Listener = null;
  let result;
  try {
    runUpdates(() => result = fn(() => cleanNode(root)), true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  return result;
}
function createSignal(value, areEqual) {
  const s = {
    value,
    observers: null,
    observerSlots: null,
    pending: NOTPENDING,
    comparator: areEqual ? typeof areEqual === "function" ? areEqual : equalFn : undefined
  };
  return [readSignal.bind(s), writeSignal.bind(s)];
}
function createRenderEffect(fn, value) {
  updateComputation(createComputation(fn, value, false));
}
function createMemo(fn, value, areEqual) {
  const c = createComputation(fn, value, true);
  c.pending = NOTPENDING;
  c.observers = null;
  c.observerSlots = null;
  c.state = 0;
  c.comparator = areEqual ? typeof areEqual === "function" ? areEqual : equalFn : undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function batch(fn) {
  if (Pending) return fn();
  const q = Pending = [],
        result = fn();
  Pending = null;
  runUpdates(() => {
    for (let i = 0; i < q.length; i += 1) {
      const data = q[i];
      if (data.pending !== NOTPENDING) {
        const pending = data.pending;
        data.pending = NOTPENDING;
        writeSignal.call(data, pending);
      }
    }
  }, false);
  return result;
}
function untrack(fn) {
  let result,
      listener = Listener;
  Listener = null;
  result = fn();
  Listener = listener;
  return result;
}
function onCleanup(fn) {
  if (Owner === null) console.warn("cleanups created outside a `createRoot` or `render` will never be run");else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function getListener() {
  return Listener;
}
function readSignal() {
  if (this.state && this.sources) {
    const updates = Updates;
    Updates = null;
    this.state === STALE ? updateComputation(this) : lookDownstream(this);
    Updates = updates;
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(value, isComp) {
  if (this.comparator) {
    if (this.comparator(this.value, value)) return value;
  }
  if (Pending) {
    if (this.pending === NOTPENDING) Pending.push(this);
    this.pending = value;
    return value;
  }
  this.value = value;
  if (this.observers && (!Updates || this.observers.length)) {
    runUpdates(() => {
      for (let i = 0; i < this.observers.length; i += 1) {
        const o = this.observers[i];
        if (o.observers && o.state !== PENDING) markUpstream(o);
        o.state = STALE;
        if (o.pure) Updates.push(o);else Effects.push(o);
      }
      if (Updates.length > 10e5) {
        Updates = [];
        throw new Error("Potential Infinite Loop Detected.");
      }
    }, false);
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const owner = Owner,
        listener = Listener,
        time = ExecCount;
  Listener = Owner = node;
  runComputation(node, node.value, time);
  Listener = listener;
  Owner = owner;
}
function runComputation(node, value, time) {
  let nextValue;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    handleError(err);
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.observers && node.observers.length) {
      writeSignal.call(node, nextValue, true);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure) {
  const c = {
    fn,
    state: STALE,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: null,
    pure
  };
  if (Owner === null) console.warn("computations created outside a `createRoot` or `render` will never be disposed");else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  let top = node.state === STALE && node,
      pending;
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  while (node.fn && (node = node.owner)) {
    if (node.state === PENDING) pending = node;else if (node.state === STALE) {
      top = node;
      pending = undefined;
    }
  }
  if (pending) {
    const updates = Updates;
    Updates = null;
    lookDownstream(pending);
    Updates = updates;
    if (!top || top.state !== STALE) return;
  }
  top && updateComputation(top);
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    fn();
  } catch (err) {
    handleError(err);
  } finally {
    do {
      if (Updates) {
        runQueue(Updates);
        Updates = [];
      }
      if (!wait) {
        runEffects(Effects);
        Effects = [];
      }
    } while (Updates && Updates.length);
    Updates = null;
    if (wait) return;
    Effects = null;
  }
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function lookDownstream(node) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      if (source.state === STALE) runTop(source);else if (source.state === PENDING) lookDownstream(source);
    }
  }
}
function markUpstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      o.observers && markUpstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
            index = node.sourceSlots.pop(),
            obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
              s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.owned) {
    for (i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
  node.context = null;
}
function handleError(err) {
  throw err;
}

const $RAW = Symbol("state-raw"),
      $NODE = Symbol("state-node"),
      $PROXY = Symbol("state-proxy");
function wrap(value, traps) {
  return value[$PROXY] || (value[$PROXY] = new Proxy(value, traps || proxyTraps));
}
function isWrappable(obj) {
  return obj != null && typeof obj === "object" && (obj.__proto__ === Object.prototype || Array.isArray(obj));
}
function unwrap(item, skipGetters) {
  let result, unwrapped, v, prop;
  if (result = item != null && item[$RAW]) return result;
  if (!isWrappable(item)) return item;
  if (Array.isArray(item)) {
    if (Object.isFrozen(item)) item = item.slice(0);
    for (let i = 0, l = item.length; i < l; i++) {
      v = item[i];
      if ((unwrapped = unwrap(v, skipGetters)) !== v) item[i] = unwrapped;
    }
  } else {
    if (Object.isFrozen(item)) item = Object.assign({}, item);
    let keys = Object.keys(item),
        desc = skipGetters && Object.getOwnPropertyDescriptors(item);
    for (let i = 0, l = keys.length; i < l; i++) {
      prop = keys[i];
      if (skipGetters && desc[prop].get) continue;
      v = item[prop];
      if ((unwrapped = unwrap(v, skipGetters)) !== v) item[prop] = unwrapped;
    }
  }
  return item;
}
function getDataNodes(target) {
  let nodes = target[$NODE];
  if (!nodes) target[$NODE] = nodes = {};
  return nodes;
}
const proxyTraps = {
  get(target, property, receiver) {
    if (property === $RAW) return target;
    if (property === $PROXY) return receiver;
    const value = target[property];
    if (property === $NODE || property === "__proto__") return value;
    const wrappable = isWrappable(value);
    if (getListener() && (typeof value !== "function" || target.hasOwnProperty(property))) {
      let nodes, node;
      if (wrappable && (nodes = getDataNodes(value))) {
        node = nodes._ || (nodes._ = createSignal());
        node[0]();
      }
      nodes = getDataNodes(target);
      node = nodes[property] || (nodes[property] = createSignal());
      node[0]();
    }
    return wrappable ? wrap(value) : value;
  },
  set() {
    return true;
  },
  deleteProperty() {
    return true;
  }
};
function setProperty(state, property, value, force) {
  if (!force && state[property] === value) return;
  const notify = Array.isArray(state) || !(property in state);
  if (value === undefined) {
    delete state[property];
  } else state[property] = value;
  let nodes = getDataNodes(state),
      node;
  (node = nodes[property]) && node[1]();
  notify && (node = nodes._) && node[1]();
}
function mergeState(state, value, force) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    setProperty(state, key, value[key], force);
  }
}
function updatePath(current, path, traversed = []) {
  let part,
      prev = current;
  if (path.length > 1) {
    part = path.shift();
    const partType = typeof part,
          isArray = Array.isArray(current);
    if (Array.isArray(part)) {
      for (let i = 0; i < part.length; i++) {
        updatePath(current, [part[i]].concat(path), [part[i]].concat(traversed));
      }
      return;
    } else if (isArray && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), [i].concat(traversed));
      }
      return;
    } else if (isArray && partType === "object") {
      const {
        from = 0,
        to = current.length - 1,
        by = 1
      } = part;
      for (let i = from; i <= to; i += by) {
        updatePath(current, [i].concat(path), [i].concat(traversed));
      }
      return;
    } else if (path.length > 1) {
      updatePath(current[part], path, [part].concat(traversed));
      return;
    }
    prev = current[part];
    traversed = [part].concat(traversed);
  }
  let value = path[0];
  if (typeof value === "function") {
    value = value(prev, traversed);
    if (value === prev) return;
  }
  if (part === undefined && value == undefined) return;
  value = unwrap(value);
  if (part === undefined || isWrappable(prev) && isWrappable(value) && !Array.isArray(value)) {
    mergeState(prev, value);
  } else setProperty(current, part, value);
}
function createState(state) {
  const unwrappedState = unwrap(state || {}, true);
  const wrappedState = wrap(unwrappedState);
  function setState(...args) {
    batch(() => updatePath(unwrappedState, args));
  }
  return [wrappedState, setState];
}

const FALLBACK = Symbol("fallback");
function mapArray(list, mapFn, options = {}) {
  let items = [],
      mapped = [],
      disposers = [],
      len = 0,
      indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => {
    for (let i = 0, length = disposers.length; i < length; i++) disposers[i]();
  });
  return () => {
    let newItems = list() || [],
        i,
        j;
    return untrack(() => {
      let newLen = newItems.length,
          newIndices,
          newIndicesNext,
          temp,
          tempdisposers,
          tempIndexes,
          start,
          end,
          newEnd,
          item;
      if (newLen === 0) {
        if (len !== 0) {
          for (i = 0; i < len; i++) disposers[i]();
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
          for (j = 0; j < newLen; j++) {
            items[j] = newItems[j];
            mapped[j] = createRoot(mapper);
          }
          len = newLen;
        } else {
          temp = new Array(newLen);
          tempdisposers = new Array(newLen);
          indexes && (tempIndexes = new Array(newLen));
          for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
          for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
            temp[newEnd] = mapped[end];
            tempdisposers[newEnd] = disposers[end];
            indexes && (tempIndexes[newEnd] = indexes[end]);
          }
          newIndices = new Map();
          newIndicesNext = new Array(newEnd + 1);
          for (j = newEnd; j >= start; j--) {
            item = newItems[j];
            i = newIndices.get(item);
            newIndicesNext[j] = i === undefined ? -1 : i;
            newIndices.set(item, j);
          }
          for (i = start; i <= end; i++) {
            item = items[i];
            j = newIndices.get(item);
            if (j !== undefined && j !== -1) {
              temp[j] = mapped[i];
              tempdisposers[j] = disposers[i];
              indexes && (tempIndexes[j] = indexes[i]);
              j = newIndicesNext[j];
              newIndices.set(item, j);
            } else disposers[i]();
          }
          for (j = start; j < newLen; j++) {
            if (j in temp) {
              mapped[j] = temp[j];
              disposers[j] = tempdisposers[j];
              if (indexes) {
                indexes[j] = tempIndexes[j];
                indexes[j](j);
              }
            } else mapped[j] = createRoot(mapper);
          }
          len = mapped.length = newLen;
          items = newItems.slice(0);
        }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j, true);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}

function createComponent(Comp, props) {
  return untrack(() => Comp(props));
}
function assignProps(target, ...sources) {
  for (let i = 0; i < sources.length; i++) {
    const descriptors = Object.getOwnPropertyDescriptors(sources[i]);
    Object.defineProperties(target, descriptors);
  }
  return target;
}

function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback ? fallback : undefined));
}
function Show(props) {
  const childDesc = Object.getOwnPropertyDescriptor(props, "children").value,
        callFn = typeof childDesc === "function" && childDesc.length,
        condition = createMemo(callFn ? () => props.when : () => !!props.when, undefined, true);
  return createMemo(() => {
    const c = condition();
    return c ? callFn ? untrack(() => props.children(c)) : props.children : props.fallback;
  });
}

if (!globalThis.Solid$$) globalThis.Solid$$ = true;else console.warn("You appear to have multiple instances of Solid. This can lead to unexpected behavior.");

function memo(fn, equal) {
  return createMemo(fn, undefined, equal);
}

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
      aEnd = a.length,
      bEnd = bLength,
      aStart = 0,
      bStart = 0,
      after = a[aEnd - 1].nextSibling,
      map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) parentNode.removeChild(a[aStart]);
        aStart++;
      }
    } else if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
    } else if (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
              sequence = 1,
              t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else parentNode.removeChild(a[aStart++]);
    }
  }
}

const eventRegistry = new Set();
function render(code, element, init) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    insert(element, code(), element.firstChild ? null : undefined, init);
  });
  return disposer;
}
function template(html, check, isSVG) {
  const t = document.createElement("template");
  t.innerHTML = html;
  if (check && t.innerHTML.split("<").length - 1 !== check) throw `Template html does not match input:\n${t.innerHTML}\n\n${html}`;
  let node = t.content.firstChild;
  if (isSVG) node = node.firstChild;
  return node;
}
function delegateEvents(eventNames) {
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!eventRegistry.has(name)) {
      eventRegistry.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value === false || value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function style(node, value, prev) {
  const nodeStyle = node.style;
  if (typeof value === "string") return nodeStyle.cssText = value;
  let v, s;
  if (prev != null && typeof prev !== "string") {
    for (s in value) {
      v = value[s];
      v !== prev[s] && nodeStyle.setProperty(s, v);
    }
    for (s in prev) {
      value[s] == null && nodeStyle.removeProperty(s);
    }
  } else {
    for (s in value) nodeStyle.setProperty(s, value[s]);
  }
  return value;
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function dynamicProperty(props, key) {
  const src = props[key];
  Object.defineProperty(props, key, {
    get() {
      return src();
    },
    enumerable: true
  });
  return props;
}
function eventHandler(e) {
  const key = `__${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node;
    }
  });
  while (node !== null) {
    const handler = node[key];
    if (handler) {
      const data = node[`${key}Data`];
      data !== undefined ? handler(data, e) : handler(e);
      if (e.cancelBubble) return;
    }
    node = node.host && node.host instanceof Node ? node.host : node.parentNode;
  }
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
        multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => current = insertExpression(parent, value(), current, marker));
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    if (normalizeIncomingArray(array, value, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else {
      if (Array.isArray(current)) {
        if (current.length === 0) {
          appendNodes(parent, array, marker);
        } else reconcileArrays(parent, current, array);
      } else if (current == null || current === "") {
        appendNodes(parent, array);
      } else {
        reconcileArrays(parent, multi && current || [parent.firstChild], array);
      }
    }
    current = array;
  } else if (value instanceof Node) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else console.warn(`Skipped inserting`, value);
  return current;
}
function normalizeIncomingArray(normalized, array, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
        t;
    if (item instanceof Node) {
      normalized.push(item);
    } else if (item == null || item === true || item === false) ; else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item) || dynamic;
    } else if ((t = typeof item) === "string") {
      normalized.push(document.createTextNode(item));
    } else if (t === "function") {
      if (unwrap) {
        const idx = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(idx) ? idx : [idx]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else normalized.push(document.createTextNode(item.toString()));
  }
  return dynamic;
}
function appendNodes(parent, array, marker) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && parent.removeChild(el);
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const user = JSON.parse(localStorage.getItem('user')) || {
  name: 'user',
  password: ''
};

const login = (name, password) => {
  localStorage.setItem('user', JSON.stringify({
    name,
    password,
    credentials: true
  }));
  location.assign('');
};

const check = response => response.ok ? response : Promise.reject({
  message: `Could not connect to backend: ${response.status} ${response.statusText}`,
  status: response.status
});

const query = (url, body) => fetch(url, {
  headers: {
    'Authorization': `Basic ${btoa(user.name + ':' + user.password)}`,
    'Content-Type': 'application/json'
  },
  method: body ? 'PUT' : 'GET',
  body: JSON.stringify(body)
});

const load = () => query('api/').then(check).then(response => response.json());

const save = (param, value) => query(`api/${param}/`, value).then(check);

const feeds = (url, num) => fetch(`feed/${encodeURIComponent(url)}`).then(response => response.ok ? response : Promise.reject(`Connection failed: Could not load articles from ${url}`)).then(data => data.json()).then(data => data || Promise.reject(`Parsing failed: Could not load articles from ${url}`)).then(data => data.sort((a, b) => b.date - a.date).slice(0, num));

const notify = (feed, articles) => {
  const message = {
    title: `${feed.title}: ${articles.length} new article` + articles.length === 1 ? '' : 's',
    body: articles.map(article => article.title).join('\n'),
    icon: `https://${feed.url.split('/')[2]}/favicon.ico`
  };
  if (articles.length && document.hidden && Notification.permission === 'granted') new Notification(message.title, message);
};

var api = {
  user,
  login,
  load,
  save,
  feeds,
  notify
};

let state = {
  feeds: [],
  read: {},
  articles: {},
  settings: {
    load: 50,
    frequency: 5,
    zoom: 0,
    cache: true,
    overwrite: true,
    notify: false,
    invert: false,
    layout: false,
    dark: false,
    showread: false
  }
};
if (localStorage.getItem('state')) state = JSON.parse(localStorage.getItem('state'));
state.loading = true;
state.editing = state.error = state.search = state.configure = false;
state.selected = state.feeds.map(feed => feed.url);
var init = state;

const _tmpl$ = template(`<div><input id="email" type="text" placeholder="Username"></div>`, 3),
      _tmpl$2 = template(`<div><input id="password" type="password" placeholder="Password"></div>`, 3),
      _tmpl$3 = template(`<div><button title="Login"><span class="icon fa fa-sign-in"></span><span>Login</span></button></div>`, 8),
      _tmpl$4 = template(`<main class="full"><h2>Login</h2><div></div></main>`, 6);

const background = color => ({
  'border-radius': '2px',
  padding: '1em 1.5em',
  margin: '1.5em 0',
  background: color
});

const message = error => {
  if (!error) return `Logged in as ${api.user.name}.`;
  if (error.status !== 401) return error.message || error;
  if (api.user.credentials) return 'Wrong username / password combination';
  return 'Please log in to continue';
};

const Login = props => (() => {
  const _el$ = _tmpl$4.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.nextSibling;

  insert(_el$3, () => message(props.error));

  insert(_el$, createComponent(Show, {
    get when() {
      return props.error;
    },

    get children() {
      return [(() => {
        const _el$4 = _tmpl$.cloneNode(true),
              _el$5 = _el$4.firstChild;

        createRenderEffect(() => _el$5.defaultValue = api.user.name);

        return _el$4;
      })(), (() => {
        const _el$6 = _tmpl$2.cloneNode(true),
              _el$7 = _el$6.firstChild;

        createRenderEffect(() => _el$7.defaultValue = api.user.password);

        return _el$6;
      })(), (() => {
        const _el$8 = _tmpl$3.cloneNode(true),
              _el$9 = _el$8.firstChild;

        _el$8.style.setProperty("margin-top", '1.5em');

        _el$9.__click = () => api.login(document.querySelector('#email').value, document.querySelector('#password').value);

        return _el$8;
      })()];
    }

  }), null);

  createRenderEffect(_$p => style(_el$3, background(!props.error || props.error.status === 401 ? '#46f' : '#f35'), _$p));

  return _el$;
})();

delegateEvents(["click"]);

const _tmpl$$1 = template(`<main><h2>Settings</h2><div>Articles per feed<input type="text" min="1" max="200"></div><div>Update interval (minutes)<input type="text" min="1" max="60"></div><div><button><span></span></button></div><div>Use cache<button><span></span></button></div><div>Dark menu<button><span></span></button></div></main>`, 28);

const General = props => (() => {
  const _el$ = _tmpl$$1.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.nextSibling,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$4.nextSibling,
        _el$6 = _el$3.nextSibling,
        _el$7 = _el$6.firstChild,
        _el$8 = _el$7.nextSibling,
        _el$9 = _el$6.nextSibling,
        _el$10 = _el$9.firstChild,
        _el$11 = _el$10.firstChild,
        _el$12 = _el$9.nextSibling,
        _el$13 = _el$12.firstChild,
        _el$14 = _el$13.nextSibling,
        _el$15 = _el$14.firstChild,
        _el$16 = _el$12.nextSibling,
        _el$17 = _el$16.firstChild,
        _el$18 = _el$17.nextSibling,
        _el$19 = _el$18.firstChild;

  _el$5.onchange = event => props.set({
    load: event.target.value
  });

  _el$5.style.setProperty("width", '6.25em');

  _el$8.onchange = event => props.set({
    frequency: event.target.value
  });

  _el$8.style.setProperty("width", '6.25em');

  insert(_el$9, () => props.settings.notify ? 'Disable notifications' : 'Enable notifications', _el$10);

  _el$10.__click = () => {
    !props.settings.notify && Notification.requestPermission();
    props.set({
      notify: !props.settings.notify
    });
  };

  _el$14.__click = () => props.set({
    cache: !props.settings.cache
  });

  _el$18.__click = () => props.set({
    invert: !props.settings.invert
  });

  createRenderEffect(_p$ => {
    const _v$ = props.settings.load,
          _v$2 = props.settings.frequency,
          _v$3 = props.settings.notify ? 'fa fa-bell-slash' : 'fa fa-bell',
          _v$4 = props.settings.cache ? 'fa fa-toggle-on' : 'fa fa-toggle-off',
          _v$5 = props.settings.invert ? 'fa fa-check-square-o' : 'fa fa-square-o';

    _v$ !== _p$._v$ && (_el$5.value = _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && (_el$8.value = _p$._v$2 = _v$2);
    _v$3 !== _p$._v$3 && (_el$11.className = _p$._v$3 = _v$3);
    _v$4 !== _p$._v$4 && (_el$15.className = _p$._v$4 = _v$4);
    _v$5 !== _p$._v$5 && (_el$19.className = _p$._v$5 = _v$5);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined,
    _v$3: undefined,
    _v$4: undefined,
    _v$5: undefined
  });

  return _el$;
})();

delegateEvents(["click"]);

const stringify = (title, feeds) => `<opml version="1.0">
  <head>
    <title>${title}</title>
  </head>
  <body>
    ${feeds.map(feed => `<outline text="${feed.title}" title="${feed.title}" type="rss" xmlUrl="${feed.url}" />`).join('')}
  </body>
</opml>`;

const outlines = xml => Array.from(new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('outline'));

const parse = xml => outlines(xml).filter(element => element.getAttribute('xmlUrl')).map(element => ({
  title: element.getAttribute('title') || element.getAttribute('text'),
  url: element.getAttribute('xmlUrl'),
  tags: []
}));

const _tmpl$$2 = template(`<span><a></a></span>`, 4),
      _tmpl$2$1 = template(`<span></span>`, 2),
      _tmpl$3$1 = template(`<input type="file">`, 1);

const prevent = fn => event => {
  event.preventDefault();
  fn(event);
};

const objectUrl = (content, type) => URL.createObjectURL(new Blob([content]), {
  type: type || 'text/plain'
});

const parse$1 = files => Array.from(files).map(file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;

  reader.onload = event => resolve(event.target.result);

  reader.readAsText(file);
}));

const Output = props => (() => {
  const _el$ = _tmpl$$2.cloneNode(true),
        _el$2 = _el$.firstChild;

  _el$.__click = event => event.currentTarget.firstChild.click();

  _el$2.style.setProperty("display", 'none');

  insert(_el$, () => props.children, null);

  createRenderEffect(_p$ => {
    const _v$ = props.name,
          _v$2 = objectUrl(props.getContent(), props.type);

    _v$ !== _p$._v$ && (_el$2.download = _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && setAttribute(_el$2, "href", _p$._v$2 = _v$2);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined
  });

  return _el$;
})();

const Input = props => (() => {
  const _el$3 = _tmpl$2$1.cloneNode(true);

  _el$3.__click = event => event.currentTarget.firstChild.click();

  insert(_el$3, () => (() => {
    const _el$4 = _tmpl$3$1.cloneNode(true);

    _el$4.onchange = prevent(event => parse$1(event.target.files).map(file => file.then(props.handleData)));

    _el$4.style.setProperty("display", 'none');

    createRenderEffect(_p$ => {
      const _v$3 = props.multiple,
            _v$4 = props.accept;
      _v$3 !== _p$._v$3 && (_el$4.multiple = _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && (_el$4.accept = _p$._v$4 = _v$4);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined
    });

    return _el$4;
  })(), null);

  insert(_el$3, () => props.children, null);

  return _el$3;
})();

const Dropzone = props => {
  const [state, setState] = createState({
    error: false,
    success: false,
    drag: false
  });

  const drop = event => parse$1(event.dataTransfer.files).forEach(file => file.then(props.handleData).then(() => setState({
    drag: false,
    success: true,
    error: false
  })).catch(error => setState({
    drag: false,
    error
  })));

  const dragOver = () => setState({
    drag: true
  });

  const dragLeave = () => setState({
    drag: false
  });

  return (() => {
    const _el$5 = _tmpl$2$1.cloneNode(true);

    _el$5.__dragleave = dragLeave;
    _el$5.__dragover = prevent(dragOver);
    _el$5.__drop = prevent(drop);

    insert(_el$5, (() => {
      const _c$ = memo(() => typeof props.children === 'function', true);

      return () => _c$() ? props.children(state) : props.children;
    })());

    return _el$5;
  })();
};

delegateEvents(["click", "drop", "dragover", "dragleave"]);

const _tmpl$$3 = template(`<p></p>`, 2),
      _tmpl$2$2 = template(`<button title="import OPML"><span class="fa fa-upload"></span></button>`, 4),
      _tmpl$3$2 = template(`<button title="export OPML"><span class="fa fa-download"></span></button>`, 4),
      _tmpl$4$1 = template(`<main><h2>Import / Export</h2><div>Overwrite existing feeds<button><span></span></button></div><div>Import OPML</div><div>Export OPML</div></main>`, 14);

const dropzone = state => (() => {
  const _el$ = _tmpl$$3.cloneNode(true);

  _el$.style.setProperty("border", '2px dashed');

  _el$.style.setProperty("margin", '2em 0');

  _el$.style.setProperty("padding", '1.5em');

  _el$.style.setProperty("text-align", 'center');

  insert(_el$, () => state.error ? state.error : state.success ? 'Successfully imported OPML' : 'Drop opml here to import');

  createRenderEffect(_p$ => {
    const _v$ = state.drag ? '#222' : 'transparent',
          _v$2 = state.error ? '#f45' : state.drag || state.success ? '#0c6' : '#68f';

    _v$ !== _p$._v$ && _el$.style.setProperty("background", _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && _el$.style.setProperty("color", _p$._v$2 = _v$2);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined
  });

  return _el$;
})();

const Feeds = props => (() => {
  const _el$2 = _tmpl$4$1.cloneNode(true),
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.nextSibling,
        _el$5 = _el$4.firstChild,
        _el$6 = _el$5.nextSibling,
        _el$7 = _el$6.firstChild,
        _el$8 = _el$4.nextSibling,
        _el$9 = _el$8.firstChild,
        _el$11 = _el$8.nextSibling,
        _el$12 = _el$11.firstChild;

  _el$6.__click = () => props.set({
    overwrite: !props.settings.overwrite
  });

  insert(_el$8, createComponent(Input, {
    readAs: "Text",
    handleData: text => parse(text).length ? props.upload(parse(text)) : Promise.reject('Could not parse file'),

    get children() {
      return _tmpl$2$2.cloneNode(true);
    }

  }), null);

  insert(_el$11, createComponent(Output, {
    getContent: () => stringify('Zen Reader export', props.feeds),
    name: "exported feeds.opml",
    type: "application/xml",

    get children() {
      return _tmpl$3$2.cloneNode(true);
    }

  }), null);

  insert(_el$2, createComponent(Dropzone, {
    handleData: text => parse(text).length ? props.upload(parse(text)) : Promise.reject('Could not parse file'),
    children: dropzone
  }), null);

  createRenderEffect(() => _el$7.className = props.settings.overwrite ? 'fa fa-toggle-on' : 'fa fa-toggle-off');

  return _el$2;
})();

delegateEvents(["click"]);

const _tmpl$$4 = template(`<a class="github-corner"><svg width="80" height="80" viewBox="0 0 250 250"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg><style>.github-corner:hover .octo-arm{animation:octocat-wave 560ms ease-in-out}@keyframes octocat-wave{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-25deg)}40%,80%{transform:rotate(10deg)}}@media (max-width:500px){.github-corner:hover .octo-arm{animation:none}.github-corner .octo-arm{animation:octocat-wave 560ms ease-in-out}}</style></a>`, 12);

const Github = props => (() => {
  const _el$ = _tmpl$$4.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.nextSibling;

  _el$2.style.setProperty("position", "absolute");

  _el$2.style.setProperty("border", 0);

  _el$2.style.setProperty("top", 0);

  _el$2.style.setProperty("right", 0);

  _el$4.style.setProperty("transform-origin", "130px 106px");

  createRenderEffect(_p$ => {
    const _v$ = 'https://github.com/' + props.repo,
          _v$2 = props.background,
          _v$3 = props.color;

    _v$ !== _p$._v$ && setAttribute(_el$, "href", _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && _el$2.style.setProperty("fill", _p$._v$2 = _v$2);
    _v$3 !== _p$._v$3 && _el$2.style.setProperty("color", _p$._v$3 = _v$3);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined,
    _v$3: undefined
  });

  return _el$;
})();

const _tmpl$$5 = template(`<main><h2>Zen Reader</h2><a href="https://github.com/niklasbuschmann/zenreader"><img src="zen.svg" class="rotate"></a><footer><span><span class="fa fa-code"></span><span>with</span><span>&lt;3</span></span><a href="https://github.com/niklasbuschmann">Niklas Buschmann</a><span>2020</span></footer></main>`, 21);

const About = props => (() => {
  const _el$ = _tmpl$$5.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.nextSibling,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$3.nextSibling,
        _el$6 = _el$5.firstChild,
        _el$7 = _el$6.firstChild,
        _el$8 = _el$7.nextSibling,
        _el$9 = _el$8.nextSibling,
        _el$10 = _el$6.nextSibling,
        _el$11 = _el$10.nextSibling;

  _el$.style.setProperty("position", 'relative');

  insert(_el$, createComponent(Github, {
    background: "#4b6fff",
    color: "white",
    repo: "niklasbuschmann/zenreader"
  }), _el$3);

  _el$3.style.setProperty("text-align", 'center');

  _el$4.style.setProperty("width", '14em');

  _el$4.style.setProperty("margin", '1.75em 0');

  _el$4.style.setProperty("transition", '.4s transform');

  _el$5.style.setProperty("padding", '.75em 2em');

  _el$5.style.setProperty("position", 'absolute');

  _el$5.style.setProperty("left", 0);

  _el$5.style.setProperty("right", 0);

  _el$5.style.setProperty("bottom", 0);

  _el$8.style.setProperty("margin", '0 .4em');

  _el$9.style.setProperty("font-weight", 'bold');

  _el$9.style.setProperty("color", '#f45');

  _el$11.style.setProperty("width", '5em');

  _el$11.style.setProperty("text-align", 'right');

  return _el$;
})();

const _tmpl$$6 = template(`<dialog open=""><div class="dark settings"><aside class="blue"><nav></nav><nav><li class="danger"><span><span class="fa fa-power-off icon"></span>Logout</span></li></nav></aside></div></dialog>`, 16),
      _tmpl$2$3 = template(`<li><span><span></span></span></li>`, 6);
const pages = {
  Login,
  General,
  Feeds,
  About
};
const icons = {
  Login: 'fa-user-circle',
  General: 'fa-wrench',
  Feeds: 'fa-rss',
  About: 'fa-terminal'
};

const nuke = () => {
  window.onunload = null;
  window.localStorage.clear();
  window.localStorage.setItem('user', JSON.stringify({
    name: '',
    password: ''
  }));
  window.location.assign('');
};

const Settings = props => (() => {
  const _el$ = _tmpl$$6.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$4.nextSibling,
        _el$6 = _el$5.firstChild;

  _el$.__click = () => props.configure(false);

  _el$2.__click = event => event.stopPropagation();

  _el$2.style.setProperty("width", '50em');

  _el$2.style.setProperty("height", '28em');

  _el$3.style.setProperty("width", '13em');

  insert(_el$4, createComponent(For, {
    get each() {
      return Object.keys(pages);
    },

    children: key => (() => {
      const _el$7 = _tmpl$2$3.cloneNode(true),
            _el$8 = _el$7.firstChild,
            _el$9 = _el$8.firstChild;

      _el$7.__click = () => props.configure(key);

      insert(_el$8, key, null);

      createRenderEffect(_p$ => {
        const _v$ = props.configured === key && 'selected',
              _v$2 = 'icon fa ' + icons[key];

        _v$ !== _p$._v$ && (_el$7.className = _p$._v$ = _v$);
        _v$2 !== _p$._v$2 && (_el$9.className = _p$._v$2 = _v$2);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined
      });

      return _el$7;
    })()
  }));

  _el$6.__click = nuke;

  insert(_el$2, () => pages[props.configured](props), null);

  return _el$;
})();

delegateEvents(["click"]);

const _tmpl$$7 = template(`<span class="icon fa fa-globe"></span>`, 2),
      _tmpl$2$4 = template(`<img class="favicon">`, 1);

const noicon = new Set();

const url = url => `https://${url.split('/')[2]}/favicon.ico`;

const handle = event => {
  noicon.add(event.target.src);
  event.target.outerHTML = '<span class="icon fa fa-globe"></span>';
};

const Favicon = ({
  src
}) => noicon.has(url(src)) ? _tmpl$$7.cloneNode(true) : (() => {
  const _el$2 = _tmpl$2$4.cloneNode(true);

  _el$2.onerror = handle;

  createRenderEffect(() => _el$2.src = url(src));

  return _el$2;
})();

const _tmpl$$8 = template(`<li><div><span class="icon fa fa-folder"></span><span></span></div><span><span></span></span></li>`, 12),
      _tmpl$2$5 = template(`<li><div><span></span></div><span class="show"><span></span></span><button class="hide fa fa-pencil"></button></li>`, 12),
      _tmpl$3$3 = template(`<aside><div><header><button class="subscribe"><span class="fa fa-rss icon"></span>Subscribe</button></header><nav></nav></div><footer><button title="switch theme"><span class="fa fa-adjust"></span></button><button title="settings"><span></span></button></footer></aside>`, 22);

const tags = feeds => feeds.flatMap(feed => feed.tags).filter((value, index, self) => self.indexOf(value) === index).map(name => ({
  name: name,
  urls: feeds.filter(feed => feed.tags.includes(name)).map(feed => feed.url)
})).filter(tag => tag.urls.length > 1);

const size = (articles, read) => (articles || []).filter(article => !read[article.id]).length;

const Category = props => (() => {
  const _el$ = _tmpl$$8.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.nextSibling,
        _el$5 = _el$2.nextSibling,
        _el$6 = _el$5.firstChild;

  _el$.__click = props.select;

  insert(_el$4, () => props.title);

  insert(_el$6, () => props.count || '');

  createRenderEffect(() => _el$.className = 'hover ' + (props.selected && 'selected'));

  return _el$;
})();

const MenuItem = props => (() => {
  const _el$7 = _tmpl$2$5.cloneNode(true),
        _el$8 = _el$7.firstChild,
        _el$9 = _el$8.firstChild,
        _el$10 = _el$8.nextSibling,
        _el$11 = _el$10.firstChild,
        _el$12 = _el$10.nextSibling;

  _el$7.__click = props.select;

  insert(_el$8, createComponent(Favicon, {
    get src() {
      return props.url;
    }

  }), _el$9);

  insert(_el$9, () => props.title);

  insert(_el$11, () => props.count || '');

  _el$12.__click = props.edit;

  createRenderEffect(() => _el$7.className = 'clear hover ' + (props.selected && 'selected'));

  return _el$7;
})();

const Menu = props => (() => {
  const _el$13 = _tmpl$3$3.cloneNode(true),
        _el$14 = _el$13.firstChild,
        _el$15 = _el$14.firstChild,
        _el$16 = _el$15.firstChild,
        _el$17 = _el$15.nextSibling,
        _el$18 = _el$14.nextSibling,
        _el$19 = _el$18.firstChild,
        _el$20 = _el$19.nextSibling,
        _el$21 = _el$20.firstChild;

  _el$13.style.setProperty("width", '20em');

  _el$16.__click = () => props.edit({});

  insert(_el$17, createComponent(For, {
    get each() {
      return [{
        name: "all feeds",
        urls: props.feeds.map(feed => feed.url)
      }].concat(tags(props.feeds));
    },

    children: category => (() => {
      const _c$ = memo(() => props.selected.length > 1, true);

      return createComponent(Category, {
        get title() {
          return category.name;
        },

        get selected() {
          return _c$() && props.selected.join() === category.urls.join();
        },

        get key() {
          return category.name;
        },

        select: () => props.select(category.urls),

        get count() {
          return category.urls.map(url => size(props.articles[url], props.read)).reduce((a, b) => a + b, 0);
        }

      });
    })()
  }), null);

  insert(_el$17, createComponent(For, {
    get each() {
      return props.feeds;
    },

    children: feed => createComponent(MenuItem, assignProps(Object.keys(feed).reduce((m$, k$) => (m$[k$] = () => feed[k$], dynamicProperty(m$, k$)), {}), {
      get selected() {
        return props.selected.length === 1 && props.selected[0] === feed.url;
      },

      get key() {
        return feed.url;
      },

      select: () => props.select([feed.url]),

      get count() {
        return size(props.articles[feed.url], props.read);
      },

      edit: event => {
        event.stopPropagation();
        props.edit(feed);
      }
    }))
  }), null);

  _el$19.__click = () => props.set({
    dark: !props.dark
  });

  _el$20.__click = () => props.configure('Login');

  createRenderEffect(_p$ => {
    const _v$ = 'sidebar ' + (props.invert && 'dark'),
          _v$2 = props.error ? 'fa fa-warning' : 'fa fa-cogs';

    _v$ !== _p$._v$ && (_el$13.className = _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && (_el$21.className = _p$._v$2 = _v$2);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined
  });

  return _el$13;
})();

delegateEvents(["click"]);

const _tmpl$$9 = template(`<header><div><button><span class="fa fa-search icon"></span></button><input type="text" placeholder="search"></div><nav><button title="mark all articles as read"><span class="fa fa-check"></span></button><button title="show read articles"><span></span></button><button title="expand articles"><span></span></button></nav></header>`, 23);

const Header = props => (() => {
  const _el$ = _tmpl$$9.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.nextSibling,
        _el$5 = _el$2.nextSibling,
        _el$6 = _el$5.firstChild,
        _el$7 = _el$6.nextSibling,
        _el$8 = _el$7.firstChild,
        _el$9 = _el$7.nextSibling,
        _el$10 = _el$9.firstChild;

  _el$4.__input = event => props.search(event.target.value.toLowerCase());

  _el$6.__click = props.markall;

  _el$7.__click = () => props.set({
    showread: !props.showread
  });

  _el$9.__click = () => props.set({
    layout: !props.layout
  });

  createRenderEffect(_p$ => {
    const _v$ = props.showread ? 'fa fa-toggle-on' : 'fa fa-toggle-off',
          _v$2 = props.layout ? 'fa fa-list' : 'fa fa-bars';

    _v$ !== _p$._v$ && (_el$8.className = _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && (_el$10.className = _p$._v$2 = _v$2);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined
  });

  return _el$;
})();

delegateEvents(["input", "click"]);

const _tmpl$$a = template(`<dialog open=""><div class="dark edit full"><main><h2></h2><input id="title" placeholder="Title" type="text"><input id="url" placeholder="Link" type="url"><input id="tags" placeholder="Tags" type="text"><div><span><button class="danger"><span class="icon fa fa-trash"></span>Delete</button></span><span><button class="cancel"><span class="icon fa fa-times-circle"></span>Cancel</button><button class="save"><span class="icon fa fa-check-square-o"></span>Save</button></span></div></main></div></dialog>`, 29);

const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];

const Edit = props => (() => {
  const _el$ = _tmpl$$a.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$4.nextSibling,
        _el$6 = _el$5.nextSibling,
        _el$7 = _el$6.nextSibling,
        _el$8 = _el$7.nextSibling,
        _el$9 = _el$8.firstChild,
        _el$10 = _el$9.firstChild,
        _el$11 = _el$9.nextSibling,
        _el$12 = _el$11.firstChild,
        _el$13 = _el$12.nextSibling;

  _el$.__click = () => props.replace([]);

  _el$2.__click = event => event.stopPropagation();

  _el$2.style.setProperty("width", '35em');

  insert(_el$4, () => props.old.title || 'Subscribe');

  _el$8.style.setProperty("margin", '1em 0 .5em');

  _el$10.__click = () => props.replace([], props.old);

  _el$12.__click = () => props.replace([]);

  _el$12.style.setProperty("margin", '0 1em');

  _el$13.__click = () => props.replace(values(), props.old);

  createRenderEffect(_p$ => {
    const _v$ = props.old.title,
          _v$2 = props.old.url,
          _v$3 = props.old.tags ? props.old.tags.join(', ') : '';

    _v$ !== _p$._v$ && (_el$5.defaultValue = _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && (_el$6.defaultValue = _p$._v$2 = _v$2);
    _v$3 !== _p$._v$3 && (_el$7.defaultValue = _p$._v$3 = _v$3);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined,
    _v$3: undefined
  });

  return _el$;
})();

delegateEvents(["click"]);

const _tmpl$$b = template(`<time></time>`, 2);

const units = [{
  count: 31104000000,
  name: 'year'
}, {
  count: 2592000000,
  name: 'month'
}, {
  count: 604800000,
  name: 'week'
}, {
  count: 86400000,
  name: 'day'
}, {
  count: 3600000,
  name: 'hour'
}, {
  count: 60000,
  name: 'minute'
}];

const toRelative = time => {
  const delta = new Date() - time;
  const diff = Math.abs(delta);
  const unit = units.find(unit => diff > unit.count) || units[units.length - 1];
  const value = Math.round(diff / unit.count) || 'less than a';
  const str = value + ' ' + unit.name + (value > 1 ? 's' : '');
  return delta > 0 ? str + ' ago' : 'in ' + str;
};

setInterval(() => document.querySelectorAll('time').forEach(time => time.innerHTML = toRelative(Date.parse(time.dateTime))), 30000);

const Time = ({
  time
}) => (() => {
  const _el$ = _tmpl$$b.cloneNode(true);

  _el$.dateTime = time;

  insert(_el$, () => toRelative(time));

  createRenderEffect(() => _el$.title = time.toLocaleString());

  return _el$;
})();

const _tmpl$$c = template(`<div class="content"><header><span></span><button title="mark as unread" class="fa fa-eye-slash"></button></header><div></div></div>`, 10),
      _tmpl$2$6 = template(`<article><header><span><a target="_blank"></a></span></header></article>`, 8);

const Article = props => {
  const [state, setState] = createState({
    open: false
  });

  const close = isread => {
    state.open && props.mark(props.article.id, isread);
    setState({
      open: !state.open
    });
  };

  return (() => {
    const _el$ = _tmpl$2$6.cloneNode(true),
          _el$2 = _el$.firstChild,
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild;

    _el$.__click = () => close(true);

    insert(_el$3, createComponent(Favicon, {
      get src() {
        return props.article.link;
      }

    }), _el$4);

    _el$4.__click = () => close(true);

    insert(_el$4, () => props.article.title);

    insert(_el$2, createComponent(Time, {
      get time() {
        return new Date(props.article.date);
      }

    }), null);

    insert(_el$, createComponent(Show, {
      get when() {
        return state.open || props.layout;
      },

      get children() {
        const _el$5 = _tmpl$$c.cloneNode(true),
              _el$6 = _el$5.firstChild,
              _el$7 = _el$6.firstChild,
              _el$8 = _el$7.nextSibling,
              _el$9 = _el$6.nextSibling;

        _el$5.__click = event => event.stopPropagation();

        insert(_el$7, () => props.article.author);

        _el$8.__click = () => close(false);

        createRenderEffect(() => _el$9.innerHTML = props.article.content);

        return _el$5;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$ = state.open ? 'open' : '',
            _v$2 = props.article.link,
            _v$3 = props.isread ? 'gray' : 'inherit';

      _v$ !== _p$._v$ && (_el$.className = _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && setAttribute(_el$4, "href", _p$._v$2 = _v$2);
      _v$3 !== _p$._v$3 && _el$4.style.setProperty("color", _p$._v$3 = _v$3);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$d = template(`<span>Parsing articles from <a></a> failed</span>`, 4),
      _tmpl$2$7 = template(`<div></div>`, 2),
      _tmpl$3$4 = template(`<h2></h2>`, 2);

const background$1 = props => {
  if (props.loading) return 'Loading ...';
  if (props.selected.length === 1 && !props.articles[props.selected[0]]) return (() => {
    const _el$ = _tmpl$$d.cloneNode(true),
          _el$2 = _el$.firstChild,
          _el$3 = _el$2.nextSibling;

    insert(_el$3, () => props.selected[0]);

    createRenderEffect(() => setAttribute(_el$3, "href", props.selected[0]));

    return _el$;
  })();
  if (props.search) return 'Nothing found ...';
  return 'No new articles available';
};

const articles = props => props.selected.flatMap(feed => props.articles[feed] || []).filter(props.search ? article => ['title', 'author', 'content'].some(prop => (article[prop] || '').toLowerCase().includes(props.search)) : !props.showread ? article => !props.read[article.id] : () => true).sort((a, b) => b.date - a.date);

const Articles = props => (() => {
  const _el$4 = _tmpl$2$7.cloneNode(true);

  _el$4.style.setProperty("overflow", 'scroll');

  insert(_el$4, createComponent(For, {
    get each() {
      return articles(props);
    },

    get fallback() {
      return (() => {
        const _el$5 = _tmpl$3$4.cloneNode(true);

        insert(_el$5, () => background$1(props));

        return _el$5;
      })();
    },

    children: article => createComponent(Article, {
      article: article,

      get isread() {
        return props.read[article.id];
      },

      get layout() {
        return props.layout;
      },

      get key() {
        return article.id;
      },

      get mark() {
        return props.mark;
      }

    })
  }));

  return _el$4;
})();

const _tmpl$$e = template(`<div><main></main></div>`, 4),
      _tmpl$2$8 = template(`<div><h1>Welcome</h1></div>`, 4);

const App = props => (() => {
  const _el$ = _tmpl$$e.cloneNode(true),
        _el$2 = _el$.firstChild;

  _el$.__dragover = () => props.configure === 'Feeds' || props.actions.configure('Feeds');

  insert(_el$, (() => {
    const _c$ = memo(() => !!props.editing, true);

    return () => _c$() && createComponent(Edit, {
      get old() {
        return props.editing;
      },

      get replace() {
        return props.actions.replace;
      }

    });
  })(), _el$2);

  insert(_el$, (() => {
    const _c$2 = memo(() => !!props.configure, true);

    return () => _c$2() && createComponent(Settings, {
      get settings() {
        return props.settings;
      },

      get feeds() {
        return props.feeds;
      },

      get configure() {
        return props.actions.configure;
      },

      get configured() {
        return props.configure;
      },

      get error() {
        return props.error;
      },

      get set() {
        return props.actions.set;
      },

      get upload() {
        return props.actions.upload;
      },

      get throwerror() {
        return props.actions.throwerror;
      }

    });
  })(), _el$2);

  insert(_el$, createComponent(Menu, {
    get feeds() {
      return props.feeds;
    },

    get selected() {
      return props.selected;
    },

    get read() {
      return props.read;
    },

    get articles() {
      return props.articles;
    },

    get dark() {
      return props.settings.dark;
    },

    get invert() {
      return props.settings.invert;
    },

    get error() {
      return props.error;
    },

    get select() {
      return props.actions.select;
    },

    get edit() {
      return props.actions.edit;
    },

    get set() {
      return props.actions.set;
    },

    get configure() {
      return props.actions.configure;
    }

  }), _el$2);

  insert(_el$2, createComponent(Header, {
    get menu() {
      return props.settings.menu;
    },

    get showread() {
      return props.settings.showread;
    },

    get layout() {
      return props.settings.layout;
    },

    get set() {
      return props.actions.set;
    },

    get search() {
      return props.actions.search;
    },

    get markall() {
      return props.actions.markall;
    }

  }), null);

  insert(_el$2, (() => {
    const _c$3 = memo(() => !!props.feeds.length, true);

    return () => _c$3() ? createComponent(Articles, {
      get articles() {
        return props.articles;
      },

      get read() {
        return props.read;
      },

      get selected() {
        return props.selected;
      },

      get search() {
        return props.search;
      },

      get loading() {
        return props.loading;
      },

      get showread() {
        return props.settings.showread;
      },

      get layout() {
        return props.settings.layout;
      },

      get mark() {
        return props.actions.mark;
      }

    }) : _tmpl$2$8.cloneNode(true);
  })(), null);

  createRenderEffect(() => _el$.className = props.settings.dark ? 'dark' : 'light');

  return _el$;
})();

delegateEvents(["dragover"]);

const Data = () => {
  const [state, setState] = createState(init);
  const actions = {};

  actions.select = selected => setState({
    selected
  });

  actions.edit = editing => setState({
    editing
  });

  actions.search = search => setState({
    search
  });

  actions.configure = configure => setState({
    configure
  });

  actions.throwerror = error => {
    setState({
      error
    });
    console.error(error);
  };

  actions.set = changed => {
    setState('settings', changed);
    api.save('settings', state.settings).catch(actions.throwerror);
  };

  actions.update = (feed, updated) => {
    if (state.articles[feed.url] && state.settings.notify) api.notify(feed, updated.filter(article => state.articles[feed.url].every(current => current.id !== article.id)));
    setState('articles', feed.url, updated);
  };

  actions.fetch = () => Promise.all(state.feeds.map(feed => api.feeds(feed.url, state.settings.load).then(articles => actions.update(feed, articles) || articles).catch(error => []))).then(articles => {
    setState({
      loading: false,
      read: Object.fromEntries(articles.flat().filter(article => state.read[article.id]).map(article => [article.id, 1]))
    });
    clearTimeout(window.timeout);
    window.timeout = setTimeout(actions.fetch, 60000 * state.settings.frequency);
  });

  actions.sync = feeds => {
    setState({
      feeds,
      selected: feeds.map(feed => feed.url),
      editing: false
    });
    api.save('feeds', feeds).catch(actions.throwerror);
    actions.fetch();
  };

  actions.replace = (updated, old) => actions.sync(updated.concat(state.feeds.filter(feed => feed !== old)));

  actions.upload = feeds => actions.sync(state.settings.overwrite ? feeds : feeds.concat(state.feeds));

  actions.mark = (id, isread) => {
    setState('read', id, isread || undefined);
    api.save('read', state.read).catch(actions.throwerror);
  };

  actions.markall = () => {
    state.selected.flatMap(url => state.articles[url]).forEach(article => setState('read', article.id, true));
    api.save('read', state.read).catch(actions.throwerror);
  };

  api.load().then(updated => {
    setState(updated);
    actions.sync(state.feeds);
  }).catch(error => {
    setState({
      error,
      configure: 'Login'
    });
  });

  window.onunload = () => {
    localStorage.setItem('state', state.settings.cache ? JSON.stringify(state) : '');
  };

  return createComponent(App, assignProps(Object.keys(state).reduce((m$, k$) => (m$[k$] = () => state[k$], dynamicProperty(m$, k$)), {}), {
    actions: actions
  }));
};

window.onload = () => render(Data, document.body);
