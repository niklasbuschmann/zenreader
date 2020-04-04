const equalFn = (a, b) => a === b;
const ERROR = Symbol("error");
const NOTPENDING = {};
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
let Owner = null;
let Listener = null;
let Pending = null;
let Updates = null;
let Afters = [];
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
    result = fn(() => cleanNode(root));
  } catch (err) {
    const fns = lookup(Owner, ERROR);
    if (!fns) throw err;
    fns.forEach(f => f(err));
  } finally {
    while (Afters.length) Afters.shift()();
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
    comparator: areEqual
  };
  return [readSignal.bind(s), writeSignal.bind(s)];
}
function createEffect(fn, value) {
  updateComputation(createComputation(fn, value));
}
function createMemo(fn, value, areEqual) {
  const c = createComputation(fn, value);
  c.pending = NOTPENDING;
  c.observers = null;
  c.observerSlots = null;
  c.comparator = areEqual;
  updateComputation(c);
  return readSignal.bind(c);
}
function freeze(fn) {
  let pending = Pending,
      q = Pending = [];
  const result = fn();
  Pending = pending;
  runUpdates(() => {
    for (let i = 0; i < q.length; i += 1) {
      const data = q[i];
      if (data.pending !== NOTPENDING) {
        const pending = data.pending;
        data.pending = NOTPENDING;
        writeSignal.call(data, pending);
      }
    }
  });
  return result;
}
function sample(fn) {
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
function isListening() {
  return Listener !== null;
}
function createContext(defaultValue) {
  const id = Symbol("context");
  return {
    id,
    Provider: createProvider(id),
    defaultValue
  };
}
function useContext(context) {
  return lookup(Owner, context.id) || context.defaultValue;
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
function writeSignal(value) {
  if (this.comparator && this.comparator(this.value, value)) return;
  if (Pending) {
    if (this.pending === NOTPENDING) Pending.push(this);
    this.pending = value;
    return;
  }
  this.value = value;
  if (this.observers && (!Updates || this.observers.length)) {
    runUpdates(() => {
      for (let i = 0; i < this.observers.length; i += 1) {
        const o = this.observers[i];
        if (o.observers && o.state !== PENDING) markUpstream(o);
        o.state = STALE;
        if (Updates.length > 10e5) throw new Error("Potential Infinite Loop Detected.");
        Updates.push(o);
      }
    });
  }
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const owner = Owner,
        listener = Listener,
        time = ExecCount;
  Listener = Owner = node;
  const nextValue = node.fn(node.value);
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.observers && node.observers.length) {
      writeSignal.call(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
  Listener = listener;
  Owner = owner;
}
function createComputation(fn, init) {
  const c = {
    fn,
    state: 0,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: null
  };
  if (Owner === null) console.warn("computations created outside a `createRoot` or `render` will never be disposed");else if (Owner !== UNOWNED) {
    if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
  }
  return c;
}
function runTop(node) {
  let top = node.state === STALE && node;
  while (node = node.owner) node.state === STALE && (top = node);
  top && updateComputation(top);
}
function runUpdates(fn) {
  if (Updates) return fn();
  Updates = [];
  ExecCount++;
  try {
    fn();
    for (let i = 0; i < Updates.length; i += 1) {
      try {
        runTop(Updates[i]);
      } catch (err) {
        const fns = lookup(Owner, ERROR);
        if (!fns) throw err;
        fns.forEach(f => f(err));
      }
    }
  } finally {
    Updates = null;
    while (Afters.length) Afters.shift()();
  }
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
    node.state = 0;
  }
  if (node.owned) {
    for (i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
}
function lookup(owner, key) {
  return owner && (owner.context && owner.context[key] || owner.owner && lookup(owner.owner, key));
}
function resolveChildren(children) {
  if (typeof children === "function") return createMemo(() => resolveChildren(children()));
  if (Array.isArray(children)) {
    const results = [];
    for (let i = 0; i < children.length; i++) {
      let result = resolveChildren(children[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children;
}
function createProvider(id) {
  return function provider(props) {
    let rendered;
    createEffect(() => {
      Owner.context = {
        [id]: props.value
      };
      rendered = sample(() => resolveChildren(props.children));
    });
    return rendered;
  };
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
function unwrap(item) {
  let result, unwrapped, v;
  if (result = item != null && item[$RAW]) return result;
  if (!isWrappable(item)) return item;
  if (Array.isArray(item)) {
    if (Object.isFrozen(item)) item = item.slice(0);
    for (let i = 0, l = item.length; i < l; i++) {
      v = item[i];
      if ((unwrapped = unwrap(v)) !== v) item[i] = unwrapped;
    }
  } else {
    if (Object.isFrozen(item)) item = Object.assign({}, item);
    let keys = Object.keys(item);
    for (let i = 0, l = keys.length; i < l; i++) {
      v = item[keys[i]];
      if ((unwrapped = unwrap(v)) !== v) item[keys[i]] = unwrapped;
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
  get(target, property) {
    if (property === $RAW) return target;
    if (property === $PROXY || property === $NODE) return;
    const value = target[property],
          wrappable = isWrappable(value);
    if (isListening() && (typeof value !== "function" || target.hasOwnProperty(property))) {
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
const setterTraps = {
  get(target, property) {
    if (property === $RAW) return target;
    const value = target[property];
    return isWrappable(value) ? new Proxy(value, setterTraps) : value;
  },
  set(target, property, value) {
    setProperty(target, property, unwrap(value));
    return true;
  },
  deleteProperty(target, property) {
    setProperty(target, property, undefined);
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
      next = current;
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
    next = current[part];
    traversed = [part].concat(traversed);
  }
  let value = path[0];
  if (typeof value === "function") {
    const wrapped = part === undefined || isWrappable(next) ? new Proxy(next, setterTraps) : next;
    value = value(wrapped, traversed);
    if (value === wrapped || value === undefined) return;
  }
  value = unwrap(value);
  if (part === undefined || isWrappable(next) && isWrappable(value) && !Array.isArray(value)) {
    mergeState(next, value);
  } else setProperty(current, part, value);
}
function createState(state) {
  const unwrappedState = unwrap(state || {});
  const wrappedState = wrap(unwrappedState);
  function setState(...args) {
    freeze(() => updatePath(unwrappedState, args));
  }
  return [wrappedState, setState];
}

const FALLBACK = Symbol("fallback");
function mapArray(list, mapFn, options) {
  if (typeof mapFn !== "function") {
    options = mapFn || {};
    mapFn = list;
    return map;
  }
  options || (options = {});
  return map(list);
  function map(list) {
    let items = [],
        mapped = [],
        disposers = [],
        len = 0;
    onCleanup(() => {
      for (let i = 0, length = disposers.length; i < length; i++) disposers[i]();
    });
    return () => {
      let newItems = list() || [],
          i,
          j;
      return sample(() => {
        let newLen = newItems.length,
            newIndices,
            newIndicesNext,
            temp,
            tempdisposers,
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
            for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
            for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
              temp[newEnd] = mapped[end];
              tempdisposers[newEnd] = disposers[end];
            }
            if (start > newEnd) {
              for (j = end; start <= j; j--) disposers[j]();
              const rLen = end - start + 1;
              if (rLen > 0) {
                mapped.splice(start, rLen);
                disposers.splice(start, rLen);
              }
              items = newItems.slice(0);
              len = newLen;
              return mapped;
            }
            if (start > end) {
              for (j = start; j <= newEnd; j++) mapped[j] = createRoot(mapper);
              for (; j < newLen; j++) {
                mapped[j] = temp[j];
                disposers[j] = tempdisposers[j];
              }
              items = newItems.slice(0);
              len = newLen;
              return mapped;
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
                j = newIndicesNext[j];
                newIndices.set(item, j);
              } else disposers[i]();
            }
            for (j = start; j < newLen; j++) {
              if (j in temp) {
                mapped[j] = temp[j];
                disposers[j] = tempdisposers[j];
              } else mapped[j] = createRoot(mapper);
            }
            len = mapped.length = newLen;
            items = newItems.slice(0);
          }
        return mapped;
      });
      function mapper(disposer) {
        disposers[j] = disposer;
        return mapFn(newItems[j], j);
      }
    };
  }
}

const runtimeConfig = {};

function createActivityTracker() {
  let count = 0;
  const [read, trigger] = createSignal(false);
  return [read, () => count++ === 0 && trigger(true), () => --count <= 0 && trigger(false)];
}
const SuspenseContext = createContext({});
const [active, increment, decrement] = createActivityTracker();
SuspenseContext.active = active;
SuspenseContext.increment = increment;
SuspenseContext.decrement = decrement;
function awaitSuspense(fn) {
  const {
    state
  } = useContext(SuspenseContext);
  let cached;
  return state ? () => state() === "suspended" ? cached : cached = fn() : fn;
}

const eventRegistry = new Set();
const config = runtimeConfig;
function template(html, check, isSVG) {
  const t = document.createElement('template');
  t.innerHTML = html;
  if (check && t.innerHTML.split("<").length - 1 !== check) console.warn(`Template html does not match input:\n${t.innerHTML}\n\n${html}`);
  let node = t.content.firstChild;
  if (isSVG) node = node.firstChild;
  return node;
}
function createComponent(Comp, props, dynamicKeys) {
  if (dynamicKeys) {
    for (let i = 0; i < dynamicKeys.length; i++) dynamicProp(props, dynamicKeys[i]);
  }
  return sample(() => Comp(props));
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
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== 'function') return insertExpression(parent, accessor, initial, marker);
  createEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function dynamicProp(props, key) {
  const src = props[key];
  Object.defineProperty(props, key, {
    get() {
      return src();
    },
    enumerable: true
  });
}
function eventHandler(e) {
  const key = `__${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, 'target', {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, 'currentTarget', {
    configurable: true,
    get() {
      return node;
    }
  });
  while (node !== null) {
    const handler = node[key];
    if (handler) {
      const data = node[`${key}Data`];
      data ? handler(data, e) : handler(e);
      if (e.cancelBubble) return;
    }
    node = node.host && node.host instanceof Node ? node.host : node.parentNode;
  }
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
    } else if ((t = typeof item) === 'string') {
      normalized.push(document.createTextNode(item));
    } else if (t === 'function') {
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
  if (marker === undefined) return parent.textContent = '';
  const node = replacement || document.createTextNode('');
  if (current.length) {
    node !== current[0] && parent.replaceChild(node, current[0]);
    for (let i = current.length - 1; i > 0; i--) parent.removeChild(current[i]);
  } else parent.insertBefore(node, marker);
  return [node];
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
        multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === 'string' || t === 'number') {
    if (t === 'number') value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== '' && typeof current === 'string') {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === 'boolean') {
    if (config.hydrate && config.hydrate.registry) return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === 'function') {
    createEffect(() => current = insertExpression(parent, value(), current, marker));
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    if (normalizeIncomingArray(array, value, unwrapArray)) {
      createEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (config.hydrate && config.hydrate.registry) return current;
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else {
      if (Array.isArray(current)) {
        if (current.length === 0) {
          appendNodes(parent, array, marker);
        } else reconcileArrays(parent, current, array);
      } else if (current == null || current === '') {
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
    } else if (current == null || current === '') {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  }
  return current;
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
    } else if (aEnd - aStart === 1 && bEnd - bStart === 1) {
      if (map && map.has(a[aStart])) {
        parentNode.insertBefore(b[bStart], bEnd < bLength ? b[bEnd] : after);
      } else parentNode.replaceChild(b[bStart], a[aStart]);
      break;
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
      if (map.has(a[aStart])) {
        const index = map.get(a[aStart]);
        if (bStart < index && index < bEnd) {
          let i = aStart,
              sequence = 1;
          while (++i < aEnd && i < bEnd) {
            if (!map.has(a[i]) || map.get(a[i]) !== index + sequence) break;
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
  return b;
}

function render(code, element) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    insert(element, code());
  });
  return disposer;
}
function wrapCondition(fn) {
  return createMemo(fn, undefined, equalFn);
}
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return awaitSuspense(createMemo(mapArray(() => props.each, props.children, fallback ? fallback : undefined)));
}
function Show(props) {
  const useFallback = ("fallback" in props),
        condition = createMemo(() => !!props.when, undefined, equalFn);
  return awaitSuspense(createMemo(() => condition() ? sample(() => props.children) : useFallback ? sample(() => props.fallback) : undefined));
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

const _tmpl$ = template(`<div><input id="email" type="text" placeholder="Username"></div>`),
      _tmpl$2 = template(`<div><input id="password" type="password" placeholder="Password"></div>`),
      _tmpl$3 = template(`<div><button title="Login"><span class="icon fa fa-sign-in"></span><span>Login</span></button></div>`),
      _tmpl$4 = template(`<main class="full"><h2>Login</h2><div></div></main>`);

const _ck$ = ["children", "when"];

const background = color => ({
  borderRadius: '2px',
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

const Login = props => function () {
  const _el$ = _tmpl$4.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.nextSibling;

  insert(_el$3, () => message(props.error));

  insert(_el$, createComponent(Show, {
    when: () => props.error,
    children: () => [(() => {
      const _el$4 = _tmpl$.cloneNode(true),
            _el$5 = _el$4.firstChild;

      createEffect(() => _el$5.defaultValue = api.user.name);

      return _el$4;
    })(), (() => {
      const _el$6 = _tmpl$2.cloneNode(true),
            _el$7 = _el$6.firstChild;

      createEffect(() => _el$7.defaultValue = api.user.password);

      return _el$6;
    })(), (() => {
      const _el$8 = _tmpl$3.cloneNode(true),
            _el$9 = _el$8.firstChild;

      Object.assign(_el$8.style, {
        marginTop: '1.5em'
      });

      _el$9.__click = () => api.login(document.querySelector('#email').value, document.querySelector('#password').value);

      return _el$8;
    })()]
  }, _ck$), null);

  createEffect(() => Object.assign(_el$3.style, background(!props.error || props.error.status === 401 ? '#46f' : '#f35')));

  return _el$;
}();

delegateEvents(["click"]);

const _tmpl$$1 = template(`<main><h2>Settings</h2><div>Articles per feed<input type="text" min="1" max="200"></div><div>Update interval (minutes)<input type="text" min="1" max="60"></div><div><button><span></span></button></div><div>Use cache<button><span></span></button></div><div>Dark menu<button><span></span></button></div></main>`);

const General = props => function () {
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

  Object.assign(_el$5.style, {
    width: '6.25em'
  });

  _el$8.onchange = event => props.set({
    frequency: event.target.value
  });

  Object.assign(_el$8.style, {
    width: '6.25em'
  });

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

  createEffect(_p$ => {
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
}();

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

const _tmpl$$2 = template(`<span><a></a></span>`),
      _tmpl$2$1 = template(`<span></span>`),
      _tmpl$3$1 = template(`<input type="file">`);

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

const Output = props => function () {
  const _el$ = _tmpl$$2.cloneNode(true),
        _el$2 = _el$.firstChild;

  _el$.__click = event => event.currentTarget.firstChild.click();

  Object.assign(_el$2.style, {
    display: 'none'
  });

  insert(_el$, () => props.children, null);

  createEffect(_p$ => {
    const _v$ = props.name,
          _v$2 = objectUrl(props.getContent(), props.type);

    _v$ !== _p$._v$ && (_el$2.download = _p$._v$ = _v$);
    _v$2 !== _p$._v$2 && _el$2.setAttribute("href", _p$._v$2 = _v$2);
    return _p$;
  }, {
    _v$: undefined,
    _v$2: undefined
  });

  return _el$;
}();

const Input = props => function () {
  const _el$3 = _tmpl$2$1.cloneNode(true);

  _el$3.__click = event => event.currentTarget.firstChild.click();

  insert(_el$3, () => function () {
    const _el$4 = _tmpl$3$1.cloneNode(true);

    _el$4.onchange = prevent(event => parse$1(event.target.files).map(file => file.then(props.handleData)));
    Object.assign(_el$4.style, {
      display: 'none'
    });

    createEffect(_p$ => {
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
  }(), null);

  insert(_el$3, () => props.children, null);

  return _el$3;
}();

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

  return function () {
    const _el$5 = _tmpl$2$1.cloneNode(true);

    _el$5.__dragleave = dragLeave;
    _el$5.__dragover = prevent(dragOver);
    _el$5.__drop = prevent(drop);

    insert(_el$5, (() => {
      const _c$ = wrapCondition(() => typeof props.children === 'function');

      return () => _c$() ? props.children(state) : props.children;
    })());

    return _el$5;
  }();
};

delegateEvents(["click", "drop", "dragover", "dragleave"]);

const _tmpl$$3 = template(`<p></p>`),
      _tmpl$2$2 = template(`<button title="import OPML"><span class="fa fa-upload"></span></button>`),
      _tmpl$3$2 = template(`<button title="export OPML"><span class="fa fa-download"></span></button>`),
      _tmpl$4$1 = template(`<main><h2>Import / Export</h2><div>Overwrite existing feeds<button><span></span></button></div><div>Import OPML</div><div>Export OPML</div></main>`);

const _ck$$1 = ["children"];

const dropzone = state => function () {
  const _el$ = _tmpl$$3.cloneNode(true);

  insert(_el$, () => state.error ? state.error : state.success ? 'Successfully imported OPML' : 'Drop opml here to import');

  createEffect(() => Object.assign(_el$.style, {
    background: state.drag ? '#222' : 'transparent',
    color: state.error ? '#f45' : state.drag || state.success ? '#0c6' : '#68f',
    border: '2px dashed',
    margin: '2em 0',
    padding: '1.5em',
    textAlign: 'center'
  }));

  return _el$;
}();

const Feeds = props => function () {
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
    children: () => _tmpl$2$2.cloneNode(true)
  }, _ck$$1), null);

  insert(_el$11, createComponent(Output, {
    getContent: () => stringify('Zen Reader export', props.feeds),
    name: "exported feeds.opml",
    type: "application/xml",
    children: () => _tmpl$3$2.cloneNode(true)
  }, _ck$$1), null);

  insert(_el$2, createComponent(Dropzone, {
    handleData: text => parse(text).length ? props.upload(parse(text)) : Promise.reject('Could not parse file'),
    children: dropzone
  }), null);

  createEffect(() => _el$7.className = props.settings.overwrite ? 'fa fa-toggle-on' : 'fa fa-toggle-off');

  return _el$2;
}();

delegateEvents(["click"]);

const _tmpl$$4 = template(`<a class="github-corner"><svg width="80" height="80" viewBox="0 0 250 250"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg><style>.github-corner:hover .octo-arm{animation:octocat-wave 560ms ease-in-out}@keyframes octocat-wave{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-25deg)}40%,80%{transform:rotate(10deg)}}@media (max-width:500px){.github-corner:hover .octo-arm{animation:none}.github-corner .octo-arm{animation:octocat-wave 560ms ease-in-out}}</style></a>`);

const Github = props => function () {
  const _el$ = _tmpl$$4.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.nextSibling,
        _el$5 = _el$2.nextSibling,
        _el$6 = _el$5.firstChild;

  Object.assign(_el$4.style, {
    transformOrigin: "130px 106px"
  });

  createEffect(_p$ => {
    const _v$ = 'https://github.com/' + props.repo;

    _v$ !== _p$._v$ && _el$.setAttribute("href", _p$._v$ = _v$);
    Object.assign(_el$2.style, {
      fill: props.background,
      color: props.color,
      position: "absolute",
      border: 0,
      top: 0,
      right: 0
    });
    return _p$;
  }, {
    _v$: undefined
  });

  return _el$;
}();

const _tmpl$$5 = template(`<main><h2>Zen Reader</h2><a href="https://github.com/niklasbuschmann/zenreader"><img src="zen.svg" class="rotate"></a><footer><span><span class="fa fa-code"></span><span>with</span><span>&lt;3</span></span><a href="https://github.com/niklasbuschmann">Niklas Buschmann</a><span>2020</span></footer></main>`);

const About = props => function () {
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

  Object.assign(_el$.style, {
    position: 'relative'
  });

  insert(_el$, createComponent(Github, {
    background: "#4b6fff",
    color: "white",
    repo: "niklasbuschmann/zenreader"
  }), _el$3);

  Object.assign(_el$3.style, {
    textAlign: 'center'
  });
  Object.assign(_el$4.style, {
    width: '14em',
    margin: '1.75em 0',
    transition: '.4s transform'
  });
  Object.assign(_el$5.style, {
    padding: '.75em 2em',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0
  });
  Object.assign(_el$8.style, {
    margin: '0 .4em'
  });
  Object.assign(_el$9.style, {
    fontWeight: 'bold',
    color: '#f45'
  });
  Object.assign(_el$11.style, {
    width: '5em',
    textAlign: 'right'
  });
  return _el$;
}();

const _tmpl$$6 = template(`<dialog open=""><div class="dark settings"><aside class="blue"><nav></nav><nav><li class="danger"><span><span class="fa fa-power-off icon"></span>Logout</span></li></nav></aside></div></dialog>`),
      _tmpl$2$3 = template(`<li><span><span></span></span></li>`);

const _ck$$2 = ["each"];
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

const Settings = props => function () {
  const _el$ = _tmpl$$6.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.firstChild,
        _el$5 = _el$4.nextSibling,
        _el$6 = _el$5.firstChild;

  _el$.__click = () => props.configure(false);

  _el$2.__click = event => event.stopPropagation();

  Object.assign(_el$2.style, {
    width: '50em',
    height: '28em'
  });
  Object.assign(_el$3.style, {
    width: '13em'
  });

  insert(_el$4, createComponent(For, {
    each: () => Object.keys(pages),
    children: key => function () {
      const _el$7 = _tmpl$2$3.cloneNode(true),
            _el$8 = _el$7.firstChild,
            _el$9 = _el$8.firstChild;

      _el$7.__click = () => props.configure(key);

      insert(_el$8, key, null);

      createEffect(_p$ => {
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
    }()
  }, _ck$$2));

  _el$6.__click = nuke;

  insert(_el$2, () => pages[props.configured](props), null);

  return _el$;
}();

delegateEvents(["click"]);

const _tmpl$$7 = template(`<span class="icon fa fa-globe"></span>`),
      _tmpl$2$4 = template(`<img class="favicon">`);

const noicon = new Set();

const url = url => `https://${url.split('/')[2]}/favicon.ico`;

const handle = event => {
  noicon.add(event.target.src);
  event.target.outerHTML = '<span class="icon fa fa-globe"></span>';
};

const Favicon = ({
  src
}) => noicon.has(url(src)) ? _tmpl$$7.cloneNode(true) : function () {
  const _el$2 = _tmpl$2$4.cloneNode(true);

  _el$2.onerror = handle;

  createEffect(() => _el$2.src = url(src));

  return _el$2;
}();

const _tmpl$$8 = template(`<li><div><span class="icon fa fa-folder"></span><span></span></div><span><span></span></span></li>`),
      _tmpl$2$5 = template(`<li><div><span></span></div><span class="show"><span></span></span><button class="hide fa fa-pencil"></button></li>`),
      _tmpl$3$3 = template(`<aside><div><header><button class="subscribe"><span class="fa fa-rss icon"></span>Subscribe</button></header><nav></nav></div><footer><button title="switch theme"><span class="fa fa-adjust"></span></button><button title="settings"><span></span></button></footer></aside>`);

const _ck$$3 = ["src"],
      _ck$2 = ["each"],
      _ck$3 = ["count", "key", "selected", "title"];

const tags = feeds => feeds.flatMap(feed => feed.tags).filter((value, index, self) => self.indexOf(value) === index).map(name => ({
  name: name,
  urls: feeds.filter(feed => feed.tags.includes(name)).map(feed => feed.url)
})).filter(tag => tag.urls.length > 1);

const size = (articles, read) => (articles || []).filter(article => !read[article.id]).length;

const Category = props => function () {
  const _el$ = _tmpl$$8.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$3.nextSibling,
        _el$5 = _el$2.nextSibling,
        _el$6 = _el$5.firstChild;

  _el$.__click = props.select;

  insert(_el$4, () => props.title);

  insert(_el$6, () => props.count || '');

  createEffect(() => _el$.className = 'hover ' + (props.selected && 'selected'));

  return _el$;
}();

const MenuItem = props => function () {
  const _el$7 = _tmpl$2$5.cloneNode(true),
        _el$8 = _el$7.firstChild,
        _el$9 = _el$8.firstChild,
        _el$10 = _el$8.nextSibling,
        _el$11 = _el$10.firstChild,
        _el$12 = _el$10.nextSibling;

  _el$7.__click = props.select;

  insert(_el$8, createComponent(Favicon, {
    src: () => props.url
  }, _ck$$3), _el$9);

  insert(_el$9, () => props.title);

  insert(_el$11, () => props.count || '');

  _el$12.__click = props.edit;

  createEffect(() => _el$7.className = 'clear hover ' + (props.selected && 'selected'));

  return _el$7;
}();

const Menu = props => function () {
  const _el$13 = _tmpl$3$3.cloneNode(true),
        _el$14 = _el$13.firstChild,
        _el$15 = _el$14.firstChild,
        _el$16 = _el$15.firstChild,
        _el$17 = _el$15.nextSibling,
        _el$18 = _el$14.nextSibling,
        _el$19 = _el$18.firstChild,
        _el$20 = _el$19.nextSibling,
        _el$21 = _el$20.firstChild;

  Object.assign(_el$13.style, {
    width: '20em'
  });

  _el$16.__click = () => props.edit({});

  insert(_el$17, createComponent(For, {
    each: () => [{
      name: "all feeds",
      urls: props.feeds.map(feed => feed.url)
    }].concat(tags(props.feeds)),
    children: category => createComponent(Category, {
      title: () => category.name,
      selected: (() => {
        const _c$ = wrapCondition(() => props.selected.length > 1);

        return () => _c$() && props.selected.join() === category.urls.join();
      })(),
      key: () => category.name,
      select: () => props.select(category.urls),
      count: () => category.urls.map(url => size(props.articles[url], props.read)).reduce((a, b) => a + b, 0)
    }, _ck$3)
  }, _ck$2), null);

  insert(_el$17, createComponent(For, {
    each: () => props.feeds,
    children: feed => createComponent(MenuItem, Object.assign(Object.keys(feed).reduce((m$, k$) => (m$[k$] = () => feed[k$], m$), {}), {
      selected: () => props.selected.length === 1 && props.selected[0] === feed.url,
      key: () => feed.url,
      select: () => props.select([feed.url]),
      count: () => size(props.articles[feed.url], props.read),
      edit: event => {
        event.stopPropagation();
        props.edit(feed);
      }
    }), ["count", "key", "selected", ...Object.keys(feed)])
  }, _ck$2), null);

  _el$19.__click = () => props.set({
    dark: !props.dark
  });

  _el$20.__click = () => props.configure('Login');

  createEffect(_p$ => {
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
}();

delegateEvents(["click"]);

const _tmpl$$9 = template(`<header><div><button><span class="fa fa-search icon"></span></button><input type="text" placeholder="search"></div><nav><button title="mark all articles as read"><span class="fa fa-check"></span></button><button title="show read articles"><span></span></button><button title="expand articles"><span></span></button></nav></header>`);

const Header = props => function () {
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

  createEffect(_p$ => {
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
}();

delegateEvents(["input", "click"]);

const _tmpl$$a = template(`<dialog open=""><div class="dark edit full"><main><h2></h2><input id="title" placeholder="Title" type="text"><input id="url" placeholder="Link" type="url"><input id="tags" placeholder="Tags" type="text"><div><span><button class="danger"><span class="icon fa fa-trash"></span>Delete</button></span><span><button class="cancel"><span class="icon fa fa-times-circle"></span>Cancel</button><button class="save"><span class="icon fa fa-check-square-o"></span>Save</button></span></div></main></div></dialog>`);

const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];

const Edit = props => function () {
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

  Object.assign(_el$2.style, {
    width: '35em'
  });

  insert(_el$4, () => props.old.title || 'Subscribe');

  Object.assign(_el$8.style, {
    margin: '1em 0 .5em'
  });

  _el$10.__click = () => props.replace([], props.old);

  _el$12.__click = () => props.replace([]);

  Object.assign(_el$12.style, {
    margin: '0 1em'
  });

  _el$13.__click = () => props.replace(values(), props.old);

  createEffect(_p$ => {
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
}();

delegateEvents(["click"]);

const _tmpl$$b = template(`<time></time>`);

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
}) => function () {
  const _el$ = _tmpl$$b.cloneNode(true);

  _el$.dateTime = time;

  insert(_el$, () => toRelative(time));

  createEffect(() => _el$.title = time.toLocaleString());

  return _el$;
}();

const _tmpl$$c = template(`<div class="content"><header><span></span><button title="mark as unread" class="fa fa-eye-slash"></button></header><div></div></div>`),
      _tmpl$2$6 = template(`<article><header><span><a target="_blank"></a></span></header></article>`);

const _ck$$4 = ["src"],
      _ck$2$1 = ["time"],
      _ck$3$1 = ["children", "when"];

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

  return function () {
    const _el$ = _tmpl$2$6.cloneNode(true),
          _el$2 = _el$.firstChild,
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild;

    _el$.__click = () => close(true);

    insert(_el$3, createComponent(Favicon, {
      src: () => props.article.link
    }, _ck$$4), _el$4);

    _el$4.__click = () => close(true);

    insert(_el$4, () => props.article.title);

    insert(_el$2, createComponent(Time, {
      time: () => new Date(props.article.date)
    }, _ck$2$1), null);

    insert(_el$, createComponent(Show, {
      when: () => state.open || props.layout,
      children: () => {
        const _el$5 = _tmpl$$c.cloneNode(true),
              _el$6 = _el$5.firstChild,
              _el$7 = _el$6.firstChild,
              _el$8 = _el$7.nextSibling,
              _el$9 = _el$6.nextSibling;

        _el$5.__click = event => event.stopPropagation();

        insert(_el$7, () => props.article.author);

        _el$8.__click = () => close(false);

        createEffect(() => _el$9.innerHTML = props.article.content);

        return _el$5;
      }
    }, _ck$3$1), null);

    createEffect(_p$ => {
      const _v$ = state.open ? 'open' : '',
            _v$2 = props.article.link;

      _v$ !== _p$._v$ && (_el$.className = _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && _el$4.setAttribute("href", _p$._v$2 = _v$2);
      Object.assign(_el$4.style, {
        color: props.isread ? 'gray' : 'inherit'
      });
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined
    });

    return _el$;
  }();
};

delegateEvents(["click"]);

const _tmpl$$d = template(`<span>Parsing articles from <a></a> failed</span>`),
      _tmpl$2$7 = template(`<div></div>`),
      _tmpl$3$4 = template(`<h2></h2>`);

const _ck$$5 = ["each", "fallback"],
      _ck$2$2 = ["isread", "key", "layout", "mark"];

const background$1 = props => {
  if (props.loading) return 'Loading ...';
  if (props.selected.length === 1 && !props.articles[props.selected[0]]) return function () {
    const _el$ = _tmpl$$d.cloneNode(true),
          _el$2 = _el$.firstChild,
          _el$3 = _el$2.nextSibling;

    insert(_el$3, () => props.selected[0]);

    createEffect(() => _el$3.setAttribute("href", props.selected[0]));

    return _el$;
  }();
  if (props.search) return 'Nothing found ...';
  return 'No new articles available';
};

const articles = props => props.selected.flatMap(feed => props.articles[feed] || []).filter(props.search ? article => ['title', 'author', 'content'].some(prop => (article[prop] || '').toLowerCase().includes(props.search)) : !props.showread ? article => !props.read[article.id] : () => true).sort((a, b) => b.date - a.date);

const Articles = props => function () {
  const _el$4 = _tmpl$2$7.cloneNode(true);

  Object.assign(_el$4.style, {
    overflow: 'scroll'
  });

  insert(_el$4, createComponent(For, {
    each: () => articles(props),
    fallback: () => function () {
      const _el$5 = _tmpl$3$4.cloneNode(true);

      insert(_el$5, () => background$1(props));

      return _el$5;
    }(),
    children: article => createComponent(Article, {
      article: article,
      isread: () => props.read[article.id],
      layout: () => props.layout,
      key: () => article.id,
      mark: () => props.mark
    }, _ck$2$2)
  }, _ck$$5));

  return _el$4;
}();

const _tmpl$$e = template(`<div><main></main></div>`),
      _tmpl$2$8 = template(`<div><h1>Welcome</h1></div>`);

const _ck$$6 = ["articles", "configure", "dark", "edit", "error", "feeds", "invert", "read", "select", "selected", "set"],
      _ck$2$3 = ["layout", "markall", "menu", "search", "set", "showread"],
      _ck$3$2 = ["old", "replace"],
      _ck$4 = ["configure", "configured", "error", "feeds", "set", "settings", "throwerror", "upload"],
      _ck$5 = ["articles", "layout", "loading", "mark", "read", "search", "selected", "showread"];

const App = props => function () {
  const _el$ = _tmpl$$e.cloneNode(true),
        _el$2 = _el$.firstChild;

  _el$.__dragover = () => props.configure === 'Feeds' || props.actions.configure('Feeds');

  insert(_el$, (() => {
    const _c$ = wrapCondition(() => props.editing);

    return () => _c$() && createComponent(Edit, {
      old: () => props.editing,
      replace: () => props.actions.replace
    }, _ck$3$2);
  })(), _el$2);

  insert(_el$, (() => {
    const _c$ = wrapCondition(() => props.configure);

    return () => _c$() && createComponent(Settings, {
      settings: () => props.settings,
      feeds: () => props.feeds,
      configure: () => props.actions.configure,
      configured: () => props.configure,
      error: () => props.error,
      set: () => props.actions.set,
      upload: () => props.actions.upload,
      throwerror: () => props.actions.throwerror
    }, _ck$4);
  })(), _el$2);

  insert(_el$, createComponent(Menu, {
    feeds: () => props.feeds,
    selected: () => props.selected,
    read: () => props.read,
    articles: () => props.articles,
    dark: () => props.settings.dark,
    invert: () => props.settings.invert,
    error: () => props.error,
    select: () => props.actions.select,
    edit: () => props.actions.edit,
    set: () => props.actions.set,
    configure: () => props.actions.configure
  }, _ck$$6), _el$2);

  insert(_el$2, createComponent(Header, {
    menu: () => props.settings.menu,
    showread: () => props.settings.showread,
    layout: () => props.settings.layout,
    set: () => props.actions.set,
    search: () => props.actions.search,
    markall: () => props.actions.markall
  }, _ck$2$3), null);

  insert(_el$2, (() => {
    const _c$ = wrapCondition(() => props.feeds.length);

    return () => _c$() ? createComponent(Articles, {
      articles: () => props.articles,
      read: () => props.read,
      selected: () => props.selected,
      search: () => props.search,
      loading: () => props.loading,
      showread: () => props.settings.showread,
      layout: () => props.settings.layout,
      mark: () => props.actions.mark
    }, _ck$5) : _tmpl$2$8.cloneNode(true);
  })(), null);

  createEffect(() => _el$.className = props.settings.dark ? 'dark' : 'light');

  return _el$;
}();

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
    setState({
      settings: Object.assign({}, state.settings, changed)
    });
    api.save('settings', state.settings).catch(actions.throwerror);
  };

  actions.update = (feed, updated) => {
    if (state.articles[feed.url] && state.settings.notify) api.notify(feed, updated.filter(article => state.articles[feed.url].every(current => current.id !== article.id)));
    setState(state => {
      state.articles[feed.url] = updated;
    });
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
    setState(state => {
      state.read[id] = isread || undefined;
    });
    api.save('read', state.read).catch(actions.throwerror);
  };

  actions.markall = () => {
    setState(state => {
      state.selected.flatMap(url => state.articles[url]).forEach(article => state.read[article.id] = true);
    });
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

  return createComponent(App, Object.assign(Object.keys(state).reduce((m$, k$) => (m$[k$] = () => state[k$], m$), {}), {
    actions: actions
  }), [...Object.keys(state)]);
};

window.onload = () => render(Data, document.body);
