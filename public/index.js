const IS_DEV = false;
const equalFn = (a, b) => a === b;
const $PROXY = Symbol("solid-proxy");
const SUPPORTS_PROXY = typeof Proxy === "function";
const $TRACK = Symbol("solid-track");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let ExternalSourceConfig = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener,
    owner = Owner,
    unowned = fn.length === 0,
    current = detachedOwner === undefined ? owner : detachedOwner,
    root = unowned ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: current ? current.context : null,
      owner: current
    },
    updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function batch(fn) {
  return runUpdates(fn, false);
}
function untrack(fn) {
  if (Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) ;
    return fn();
  } finally {
    Listener = listener;
  }
}
function onCleanup(fn) {
  if (Owner === null) ;else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function getListener() {
  return Listener;
}
function readSignal() {
  if (this.sources && (this.state)) {
    if ((this.state) === STALE) updateComputation(this);else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
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
function writeSignal(node, value, isComp) {
  let current = node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) ;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
        }
        if (Updates.length > 10e5) {
          Updates = [];
          if (IS_DEV) ;
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, node.value, time);
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner,
    listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Owner === null) ;else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  if ((node.state) === 0) return;
  if ((node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if ((node.state) === STALE) {
      updateComputation(node);
    } else if ((node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);else Effects.push(o);
      o.observers && markDownstream(o);
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
  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function handleError(err, owner = Owner) {
  const error = castError(err);
  throw error;
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    len = 0,
    indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
      newLen = newItems.length,
      i,
      j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
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
        mapped = new Array(newLen);
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
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}
function trueFn() {
  return true;
}
const propTraps = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    if (property === $PROXY) return true;
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};
function resolveSource(s) {
  return !(s = typeof s === "function" ? s() : s) ? {} : s;
}
function resolveSources() {
  for (let i = 0, length = this.length; i < length; ++i) {
    const v = this[i]();
    if (v !== undefined) return v;
  }
}
function mergeProps(...sources) {
  let proxy = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    proxy = proxy || !!s && $PROXY in s;
    sources[i] = typeof s === "function" ? (proxy = true, createMemo(s)) : s;
  }
  if (SUPPORTS_PROXY && proxy) {
    return new Proxy({
      get(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          const v = resolveSource(sources[i])[property];
          if (v !== undefined) return v;
        }
      },
      has(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          if (property in resolveSource(sources[i])) return true;
        }
        return false;
      },
      keys() {
        const keys = [];
        for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
        return [...new Set(keys)];
      }
    }, propTraps);
  }
  const sourcesMap = {};
  const defined = Object.create(null);
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source) continue;
    const sourceKeys = Object.getOwnPropertyNames(source);
    for (let i = sourceKeys.length - 1; i >= 0; i--) {
      const key = sourceKeys[i];
      if (key === "__proto__" || key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (!defined[key]) {
        defined[key] = desc.get ? {
          enumerable: true,
          configurable: true,
          get: resolveSources.bind(sourcesMap[key] = [desc.get.bind(source)])
        } : desc.value !== undefined ? desc : undefined;
      } else {
        const sources = sourcesMap[key];
        if (sources) {
          if (desc.get) sources.push(desc.get.bind(source));else if (desc.value !== undefined) sources.push(() => desc.value);
        }
      }
    }
  }
  const target = {};
  const definedKeys = Object.keys(defined);
  for (let i = definedKeys.length - 1; i >= 0; i--) {
    const key = definedKeys[i],
      desc = defined[key];
    if (desc && desc.get) Object.defineProperty(target, key, desc);else target[key] = desc ? desc.value : undefined;
  }
  return target;
}

const narrowedError = name => `Stale read from <${name}>.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, undefined, undefined);
  const condition = keyed ? conditionValue : createMemo(conditionValue, undefined, {
    equals: (a, b) => !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, undefined, undefined);
}

const memo = fn => createMemo(() => fn());

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
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
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document ? code() : insert(element, code(), element.firstChild ? null : undefined, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG, isMathML) {
  let node;
  const create = () => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return t.content.firstChild;
  };
  const fn = () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, handler[0] = e => handlerFn.call(node, handler[1], e));
  } else node.addEventListener(name, handler, typeof handler !== "function" && handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}),
    prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
      classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return nodeStyle.cssText = value;
  typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function toggleClassKey(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length; i < nameLen; i++) node.classList.toggle(classNames[i], value);
}
function eventHandler(e) {
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = value => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host));
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  }
  else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
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
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      prev = current && current[normalized.length],
      t;
    if (item == null || item === true || item === false) ; else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
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
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const $RAW = Symbol("store-raw"),
  $NODE = Symbol("store-node"),
  $HAS = Symbol("store-has"),
  $SELF = Symbol("store-self");
function wrap$1(value) {
  let p = value[$PROXY];
  if (!p) {
    Object.defineProperty(value, $PROXY, {
      value: p = new Proxy(value, proxyTraps$1)
    });
    if (!Array.isArray(value)) {
      const keys = Object.keys(value),
        desc = Object.getOwnPropertyDescriptors(value);
      for (let i = 0, l = keys.length; i < l; i++) {
        const prop = keys[i];
        if (desc[prop].get) {
          Object.defineProperty(value, prop, {
            enumerable: desc[prop].enumerable,
            get: desc[prop].get.bind(p)
          });
        }
      }
    }
  }
  return p;
}
function isWrappable(obj) {
  let proto;
  return obj != null && typeof obj === "object" && (obj[$PROXY] || !(proto = Object.getPrototypeOf(obj)) || proto === Object.prototype || Array.isArray(obj));
}
function unwrap(item, set = new Set()) {
  let result, unwrapped, v, prop;
  if (result = item != null && item[$RAW]) return result;
  if (!isWrappable(item) || set.has(item)) return item;
  if (Array.isArray(item)) {
    if (Object.isFrozen(item)) item = item.slice(0);else set.add(item);
    for (let i = 0, l = item.length; i < l; i++) {
      v = item[i];
      if ((unwrapped = unwrap(v, set)) !== v) item[i] = unwrapped;
    }
  } else {
    if (Object.isFrozen(item)) item = Object.assign({}, item);else set.add(item);
    const keys = Object.keys(item),
      desc = Object.getOwnPropertyDescriptors(item);
    for (let i = 0, l = keys.length; i < l; i++) {
      prop = keys[i];
      if (desc[prop].get) continue;
      v = item[prop];
      if ((unwrapped = unwrap(v, set)) !== v) item[prop] = unwrapped;
    }
  }
  return item;
}
function getNodes(target, symbol) {
  let nodes = target[symbol];
  if (!nodes) Object.defineProperty(target, symbol, {
    value: nodes = Object.create(null)
  });
  return nodes;
}
function getNode(nodes, property, value) {
  if (nodes[property]) return nodes[property];
  const [s, set] = createSignal(value, {
    equals: false,
    internal: true
  });
  s.$ = set;
  return nodes[property] = s;
}
function proxyDescriptor$1(target, property) {
  const desc = Reflect.getOwnPropertyDescriptor(target, property);
  if (!desc || desc.get || !desc.configurable || property === $PROXY || property === $NODE) return desc;
  delete desc.value;
  delete desc.writable;
  desc.get = () => target[$PROXY][property];
  return desc;
}
function trackSelf(target) {
  getListener() && getNode(getNodes(target, $NODE), $SELF)();
}
function ownKeys(target) {
  trackSelf(target);
  return Reflect.ownKeys(target);
}
const proxyTraps$1 = {
  get(target, property, receiver) {
    if (property === $RAW) return target;
    if (property === $PROXY) return receiver;
    if (property === $TRACK) {
      trackSelf(target);
      return receiver;
    }
    const nodes = getNodes(target, $NODE);
    const tracked = nodes[property];
    let value = tracked ? tracked() : target[property];
    if (property === $NODE || property === $HAS || property === "__proto__") return value;
    if (!tracked) {
      const desc = Object.getOwnPropertyDescriptor(target, property);
      if (getListener() && (typeof value !== "function" || target.hasOwnProperty(property)) && !(desc && desc.get)) value = getNode(nodes, property, value)();
    }
    return isWrappable(value) ? wrap$1(value) : value;
  },
  has(target, property) {
    if (property === $RAW || property === $PROXY || property === $TRACK || property === $NODE || property === $HAS || property === "__proto__") return true;
    getListener() && getNode(getNodes(target, $HAS), property)();
    return property in target;
  },
  set() {
    return true;
  },
  deleteProperty() {
    return true;
  },
  ownKeys: ownKeys,
  getOwnPropertyDescriptor: proxyDescriptor$1
};
function setProperty(state, property, value, deleting = false) {
  if (!deleting && state[property] === value) return;
  const prev = state[property],
    len = state.length;
  if (value === undefined) {
    delete state[property];
    if (state[$HAS] && state[$HAS][property] && prev !== undefined) state[$HAS][property].$();
  } else {
    state[property] = value;
    if (state[$HAS] && state[$HAS][property] && prev === undefined) state[$HAS][property].$();
  }
  let nodes = getNodes(state, $NODE),
    node;
  if (node = getNode(nodes, property, prev)) node.$(() => value);
  if (Array.isArray(state) && state.length !== len) {
    for (let i = state.length; i < len; i++) (node = nodes[i]) && node.$();
    (node = getNode(nodes, "length", len)) && node.$(state.length);
  }
  (node = nodes[$SELF]) && node.$();
}
function mergeStoreNode(state, value) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    setProperty(state, key, value[key]);
  }
}
function updateArray(current, next) {
  if (typeof next === "function") next = next(current);
  next = unwrap(next);
  if (Array.isArray(next)) {
    if (current === next) return;
    let i = 0,
      len = next.length;
    for (; i < len; i++) {
      const value = next[i];
      if (current[i] !== value) setProperty(current, i, value);
    }
    setProperty(current, "length", len);
  } else mergeStoreNode(current, next);
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
        updatePath(current, [part[i]].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "object") {
      const {
        from = 0,
        to = current.length - 1,
        by = 1
      } = part;
      for (let i = from; i <= to; i += by) {
        updatePath(current, [i].concat(path), traversed);
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
    mergeStoreNode(prev, value);
  } else setProperty(current, part, value);
}
function createStore(...[store, options]) {
  const unwrappedStore = unwrap(store || {});
  const isArray = Array.isArray(unwrappedStore);
  const wrappedStore = wrap$1(unwrappedStore);
  function setStore(...args) {
    batch(() => {
      isArray && args.length === 1 ? updateArray(unwrappedStore, args[0]) : updatePath(unwrappedStore, args);
    });
  }
  return [wrappedStore, setStore];
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
const articles$1 = url => fetch(`feed/${encodeURIComponent(url)}`).then(response => response.ok ? response : Promise.reject(`Connection failed: Could not load articles from ${url}`)).then(data => data.json() || Promise.reject(`Parsing failed: Could not load articles from ${url}`)).then(data => data.sort((a, b) => b.date - a.date));
const notify = (feed, articles) => {
  const message = {
    title: `${feed.title}: ${articles.length} new article` + articles.length === 1 ? '' : 's',
    body: articles.map(article => article.title).join('\n'),
    icon: `https://${feed.url.split('/')[2]}/favicon.ico`
  };
  if (articles.length && document.hidden && Notification.permission === 'granted') new Notification(message.title, message);
};
const init = () => {
  let state = {
    feeds: [],
    read: {},
    articles: {},
    settings: {
      load: 100,
      frequency: 5,
      cache: true,
      notify: false,
      invert: false,
      layout: false,
      dark: false,
      showread: false
    }
  };
  if (localStorage.getItem('state')) state = JSON.parse(localStorage.getItem('state'));
  state.loading = true;
  state.error = false;
  return state;
};
var api = {
  user,
  login,
  load,
  save,
  articles: articles$1,
  notify,
  init
};

var _tmpl$$e = /*#__PURE__*/template(`<h2>Login`),
  _tmpl$2$8 = /*#__PURE__*/template(`<div>`),
  _tmpl$3$5 = /*#__PURE__*/template(`<div><input id=email type=text placeholder=Username style=width:inherit;text-align:inherit>`),
  _tmpl$4$3 = /*#__PURE__*/template(`<div><input id=password type=password placeholder=Password style=width:inherit;text-align:inherit>`),
  _tmpl$5$2 = /*#__PURE__*/template(`<div><button title=Login style=width:inherit><span class="icon fa fa-sign-in"></span><span>Login`);
const message = error => {
  if (!error) return `Logged in as: ${api.user.name}`;
  if (error.status !== 401) return error.message || error;
  if (api.user.credentials) return 'Wrong username / password combination';
  return 'Please log in to continue';
};
const Login = props => [_tmpl$$e(), (() => {
  var _el$2 = _tmpl$2$8();
  insert(_el$2, () => message(props.error));
  createRenderEffect(_$p => style(_el$2, `border-radius: 2px; padding: 1em 1.5em; background: ${!props.error || props.error.status === 401 ? '#0c4' : '#f35'}`, _$p));
  return _el$2;
})(), createComponent(Show, {
  get when() {
    return props.error;
  },
  get children() {
    return [(() => {
      var _el$3 = _tmpl$3$5(),
        _el$4 = _el$3.firstChild;
      createRenderEffect(() => _el$4.value = api.user.name || 'user');
      return _el$3;
    })(), (() => {
      var _el$5 = _tmpl$4$3(),
        _el$6 = _el$5.firstChild;
      createRenderEffect(() => _el$6.value = api.user.password);
      return _el$5;
    })(), (() => {
      var _el$7 = _tmpl$5$2(),
        _el$8 = _el$7.firstChild;
      _el$8.$$click = () => api.login(document.querySelector('#email').value, document.querySelector('#password').value);
      return _el$7;
    })()];
  }
})];
delegateEvents(["click"]);

var _tmpl$$d = /*#__PURE__*/template(`<h2>Settings`),
  _tmpl$2$7 = /*#__PURE__*/template(`<div>Articles per feed<input type=text min=1 max=200>`),
  _tmpl$3$4 = /*#__PURE__*/template(`<div>Update interval (minutes)<input type=text min=1 max=60>`),
  _tmpl$4$2 = /*#__PURE__*/template(`<div><button><span>`),
  _tmpl$5$1 = /*#__PURE__*/template(`<div>Use cache<button><span>`),
  _tmpl$6$1 = /*#__PURE__*/template(`<div>Dark menu<button><span>`);
const General = props => [_tmpl$$d(), (() => {
  var _el$2 = _tmpl$2$7(),
    _el$3 = _el$2.firstChild,
    _el$4 = _el$3.nextSibling;
  _el$4.addEventListener("change", event => props.set({
    load: event.target.value
  }));
  createRenderEffect(() => _el$4.value = props.settings.load);
  return _el$2;
})(), (() => {
  var _el$5 = _tmpl$3$4(),
    _el$6 = _el$5.firstChild,
    _el$7 = _el$6.nextSibling;
  _el$7.addEventListener("change", event => props.set({
    frequency: event.target.value
  }));
  createRenderEffect(() => _el$7.value = props.settings.frequency);
  return _el$5;
})(), (() => {
  var _el$8 = _tmpl$4$2(),
    _el$9 = _el$8.firstChild,
    _el$0 = _el$9.firstChild;
  insert(_el$8, () => props.settings.notify ? 'Disable notifications' : 'Enable notifications', _el$9);
  _el$9.$$click = () => {
    !props.settings.notify && Notification.requestPermission();
    props.set({
      notify: !props.settings.notify
    });
  };
  createRenderEffect(() => _el$0.className = props.settings.notify ? 'fa fa-bell-slash' : 'fa fa-bell');
  return _el$8;
})(), (() => {
  var _el$1 = _tmpl$5$1(),
    _el$10 = _el$1.firstChild,
    _el$11 = _el$10.nextSibling,
    _el$12 = _el$11.firstChild;
  _el$11.$$click = () => props.set({
    cache: !props.settings.cache
  });
  createRenderEffect(() => _el$12.className = props.settings.cache ? 'fa fa-toggle-on' : 'fa fa-toggle-off');
  return _el$1;
})(), (() => {
  var _el$13 = _tmpl$6$1(),
    _el$14 = _el$13.firstChild,
    _el$15 = _el$14.nextSibling,
    _el$16 = _el$15.firstChild;
  _el$15.$$click = () => props.set({
    invert: !props.settings.invert
  });
  createRenderEffect(() => _el$16.className = props.settings.invert ? 'fa fa-check-square-o' : 'fa fa-square-o');
  return _el$13;
})()];
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
const parse$1 = xml => outlines(xml).filter(element => element.getAttribute('xmlUrl')).map(element => ({
  title: element.getAttribute('title') || element.getAttribute('text'),
  url: element.getAttribute('xmlUrl'),
  tags: []
}));

var _tmpl$$c = /*#__PURE__*/template(`<span><a style=display:none>`),
  _tmpl$2$6 = /*#__PURE__*/template(`<span>`),
  _tmpl$3$3 = /*#__PURE__*/template(`<input type=file style=display:none>`),
  _tmpl$4$1 = /*#__PURE__*/template(`<div>`);
const prevent = fn => event => {
  event.preventDefault();
  fn(event);
};
const objectUrl = (content, type) => URL.createObjectURL(new Blob([content]), {
  type: type || 'text/plain'
});
const parse = files => Array.from(files).map(file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = event => resolve(event.target.result);
  reader.readAsText(file);
}));
const Output = props => (() => {
  var _el$ = _tmpl$$c(),
    _el$2 = _el$.firstChild;
  _el$.$$click = event => event.currentTarget.firstChild.click();
  insert(_el$, () => props.children, null);
  createRenderEffect(_p$ => {
    var _v$ = props.name,
      _v$2 = objectUrl(props.getContent(), props.type);
    _v$ !== _p$.e && setAttribute(_el$2, "download", _p$.e = _v$);
    _v$2 !== _p$.t && setAttribute(_el$2, "href", _p$.t = _v$2);
    return _p$;
  }, {
    e: undefined,
    t: undefined
  });
  return _el$;
})();
const Input = props => (() => {
  var _el$3 = _tmpl$2$6();
  _el$3.$$click = event => event.currentTarget.firstChild.click();
  insert(_el$3, () => (() => {
    var _el$4 = _tmpl$3$3();
    addEventListener(_el$4, "change", prevent(event => parse(event.target.files).map(file => file.then(props.handleData))));
    createRenderEffect(_p$ => {
      var _v$3 = props.multiple,
        _v$4 = props.accept;
      _v$3 !== _p$.e && (_el$4.multiple = _p$.e = _v$3);
      _v$4 !== _p$.t && setAttribute(_el$4, "accept", _p$.t = _v$4);
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$4;
  })(), null);
  insert(_el$3, () => props.children, null);
  return _el$3;
})();
const Dropzone = props => {
  const [state, setState] = createStore({
    error: false,
    success: false,
    drag: false
  });
  const drop = event => parse(event.dataTransfer.files).forEach(file => file.then(props.handleData).then(() => setState({
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
    var _el$5 = _tmpl$4$1();
    _el$5.addEventListener("dragleave", dragLeave);
    addEventListener(_el$5, "dragover", prevent(dragOver));
    addEventListener(_el$5, "drop", prevent(drop));
    insert(_el$5, (() => {
      var _c$ = memo(() => typeof props.children === 'function');
      return () => _c$() ? props.children(state) : props.children;
    })());
    return _el$5;
  })();
};
delegateEvents(["click"]);

var _tmpl$$b = /*#__PURE__*/template(`<p>`),
  _tmpl$2$5 = /*#__PURE__*/template(`<h2>Import / Export`),
  _tmpl$3$2 = /*#__PURE__*/template(`<button class=blue title="import OPML"><span class="fa fa-upload">`),
  _tmpl$4 = /*#__PURE__*/template(`<div>Import OPML`),
  _tmpl$5 = /*#__PURE__*/template(`<button class=blue title="export OPML"><span class="fa fa-download">`),
  _tmpl$6 = /*#__PURE__*/template(`<div>Export OPML`),
  _tmpl$7 = /*#__PURE__*/template(`<div>Delete Feeds <button class=red title="Delete feeds"><span class="fa fa-trash">`);
const dropzone = state => (() => {
  var _el$ = _tmpl$$b();
  insert(_el$, () => state.error ? state.error : state.success ? 'Successfully imported OPML' : 'Drop opml here to import');
  createRenderEffect(_$p => style(_el$, `color: ${state.error ? '#f45' : state.drag || state.success ? '#0c6' : '#46f'}; border: 2px dashed; margin: 1.5em 0; padding: 1.5em; text-align: center; border-radius: 2px; width: 100%`, _$p));
  return _el$;
})();
const Feeds = props => [_tmpl$2$5(), (() => {
  var _el$3 = _tmpl$4();
    _el$3.firstChild;
  insert(_el$3, createComponent(Input, {
    readAs: "Text",
    handleData: text => parse$1(text).length ? props.add(parse$1(text)) : Promise.reject('Could not parse file'),
    get children() {
      return _tmpl$3$2();
    }
  }), null);
  return _el$3;
})(), (() => {
  var _el$6 = _tmpl$6();
    _el$6.firstChild;
  insert(_el$6, createComponent(Output, {
    getContent: () => stringify('Zen Reader export', props.feeds),
    name: "exported feeds.opml",
    type: "application/xml",
    get children() {
      return _tmpl$5();
    }
  }), null);
  return _el$6;
})(), (() => {
  var _el$9 = _tmpl$7(),
    _el$0 = _el$9.firstChild,
    _el$1 = _el$0.nextSibling;
  _el$1.$$click = () => props.add([], false, true);
  return _el$9;
})(), createComponent(Dropzone, {
  handleData: text => parse$1(text).length ? props.add(parse$1(text)) : Promise.reject('Could not parse file'),
  children: dropzone
})];
delegateEvents(["click"]);

var _tmpl$$a = /*#__PURE__*/template(`<a class=github-corner><svg width=80 height=80 viewBox="0 0 250 250"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"fill=currentColor style="transform-origin:130px 106px"class=octo-arm></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"fill=currentColor class=octo-body></path></svg><style>.github-corner:hover .octo-arm\{animation:octocat-wave 560ms ease-in-out}@keyframes octocat-wave\{0%,100%\{transform:rotate(0)}20%,60%\{transform:rotate(-25deg)}40%,80%\{transform:rotate(10deg)}}@media (max-width:500px)\{.github-corner:hover .octo-arm\{animation:none}.github-corner .octo-arm\{animation:octocat-wave 560ms ease-in-out}}`);
const Github = props => (() => {
  var _el$ = _tmpl$$a(),
    _el$2 = _el$.firstChild;
  createRenderEffect(_p$ => {
    var _v$ = 'https://github.com/' + props.repo,
      _v$2 = `fill: ${props.background}; color: ${props.color}; position: absolute; border: 0; top: 0; right: 0`;
    _v$ !== _p$.e && setAttribute(_el$, "href", _p$.e = _v$);
    _p$.t = style(_el$2, _v$2, _p$.t);
    return _p$;
  }, {
    e: undefined,
    t: undefined
  });
  return _el$;
})();

var _tmpl$$9 = /*#__PURE__*/template(`<h2 style=margin:auto;font-size:2.2em><a href=https://github.com/niklasbuschmann/zenreader target=_blank>Zen Reader`),
  _tmpl$2$4 = /*#__PURE__*/template(`<footer style=margin-top:0><div><span class="fa fa-code"></span><span>&nbsp; with &nbsp;</span><strong style=color:#f45>&lt;3</strong></div><div>Niklas Buschmann</div><div>2015-2025`);
const About = props => [createComponent(Github, {
  background: "#46f",
  color: "white",
  repo: "niklasbuschmann/zenreader"
}), _tmpl$$9(), _tmpl$2$4()];

var _tmpl$$8 = /*#__PURE__*/template(`<dialog open><div class="dark settings overflow"><aside class=column><li><span><span class="icon fa fa-user-circle"></span>Login</span></li><li><span><span class="icon fa fa-wrench"></span>General</span></li><li><span><span class="icon fa fa-rss"></span>Feeds</span></li><li><span><span class="icon fa fa-terminal"></span>About</span></li><footer class=red><span><span class="fa fa-power-off icon"></span>Logout</span></footer></aside><main class="column grow"style=position:relative>`);
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
  var _el$ = _tmpl$$8(),
    _el$2 = _el$.firstChild,
    _el$3 = _el$2.firstChild,
    _el$4 = _el$3.firstChild,
    _el$5 = _el$4.nextSibling,
    _el$6 = _el$5.nextSibling,
    _el$7 = _el$6.nextSibling,
    _el$8 = _el$7.nextSibling,
    _el$9 = _el$3.nextSibling;
  _el$.$$click = () => props.configure(false);
  _el$2.$$click = event => event.stopPropagation();
  _el$4.$$click = () => props.configure('Login');
  _el$5.$$click = () => props.configure('General');
  _el$6.$$click = () => props.configure('Feeds');
  _el$7.$$click = () => props.configure('About');
  _el$8.$$click = nuke;
  insert(_el$9, createComponent(Show, {
    get when() {
      return props.configuring === 'Login';
    },
    get children() {
      return createComponent(Login, {
        get error() {
          return props.error;
        }
      });
    }
  }), null);
  insert(_el$9, createComponent(Show, {
    get when() {
      return props.configuring === 'General';
    },
    get children() {
      return createComponent(General, {
        get set() {
          return props.set;
        },
        get settings() {
          return props.settings;
        }
      });
    }
  }), null);
  insert(_el$9, createComponent(Show, {
    get when() {
      return props.configuring === 'Feeds';
    },
    get children() {
      return createComponent(Feeds, {
        get set() {
          return props.set;
        },
        get settings() {
          return props.settings;
        },
        get feeds() {
          return props.feeds;
        },
        get add() {
          return props.replace;
        }
      });
    }
  }), null);
  insert(_el$9, createComponent(Show, {
    get when() {
      return props.configuring === 'About';
    },
    get children() {
      return createComponent(About, {});
    }
  }), null);
  createRenderEffect(_p$ => {
    var _v$ = {
        'blue selected': props.configuring === 'Login'
      },
      _v$2 = {
        'blue selected': props.configuring === 'General'
      },
      _v$3 = {
        'blue selected': props.configuring === 'Feeds'
      },
      _v$4 = {
        'blue selected': props.configuring === 'About'
      };
    _p$.e = classList(_el$4, _v$, _p$.e);
    _p$.t = classList(_el$5, _v$2, _p$.t);
    _p$.a = classList(_el$6, _v$3, _p$.a);
    _p$.o = classList(_el$7, _v$4, _p$.o);
    return _p$;
  }, {
    e: undefined,
    t: undefined,
    a: undefined,
    o: undefined
  });
  return _el$;
})();
delegateEvents(["click"]);

var _tmpl$$7 = /*#__PURE__*/template(`<span class="icon fa fa-globe">`),
  _tmpl$2$3 = /*#__PURE__*/template(`<img class=icon>`);
const noicon = new Set();
const url = url => `https://${url.split('/')[2]}/favicon.ico`;
const handle = event => {
  noicon.add(event.target.src);
  event.target.outerHTML = '<span class="icon fa fa-globe"></span>';
};
const Favicon = ({
  src
}) => noicon.has(url(src)) ? _tmpl$$7() : (() => {
  var _el$2 = _tmpl$2$3();
  _el$2.addEventListener("error", handle);
  createRenderEffect(() => setAttribute(_el$2, "src", url(src)));
  return _el$2;
})();

var _tmpl$$6 = /*#__PURE__*/template(`<li class="shadow hover"><span class="icon fa fa-tags"></span><span class=grow></span><span>`),
  _tmpl$2$2 = /*#__PURE__*/template(`<li class="shadow hover"><span class="grow overflow"></span><span class=show><span></span></span><button class="hide fa fa-pencil">`),
  _tmpl$3$1 = /*#__PURE__*/template(`<aside class="sidebar column"><header class=shadow><button class=subscribe><span class="fa fa-rss icon"></span>Subscribe</button></header><footer class=flex><button title="switch theme"><span class="fa fa-adjust"></span></button><button title=settings><span>`);
const tags = feeds => feeds.flatMap(feed => feed.tags).filter((value, index, self) => self.indexOf(value) === index).map(name => ({
  name: name,
  urls: feeds.filter(feed => feed.tags.includes(name)).map(feed => feed.url)
})).filter(tag => tag.urls.length > 1);
const size = (articles, read) => (articles || []).filter(article => !read[article.id]).length;
const Category = props => (() => {
  var _el$ = _tmpl$$6(),
    _el$2 = _el$.firstChild,
    _el$3 = _el$2.nextSibling,
    _el$4 = _el$3.nextSibling;
  addEventListener(_el$, "click", props.select, true);
  insert(_el$3, () => props.title);
  insert(_el$4, () => props.count || '');
  createRenderEffect(() => _el$.classList.toggle("selected", !!props.selected));
  return _el$;
})();
const MenuItem = props => (() => {
  var _el$5 = _tmpl$2$2(),
    _el$6 = _el$5.firstChild,
    _el$7 = _el$6.nextSibling,
    _el$8 = _el$7.firstChild,
    _el$9 = _el$7.nextSibling;
  addEventListener(_el$5, "click", props.select, true);
  insert(_el$5, createComponent(Favicon, {
    get src() {
      return props.url;
    }
  }), _el$6);
  insert(_el$6, () => props.title);
  insert(_el$8, () => props.count || '');
  addEventListener(_el$9, "click", props.edit, true);
  createRenderEffect(() => _el$5.classList.toggle("selected", !!props.selected));
  return _el$5;
})();
const Menu = props => (() => {
  var _el$0 = _tmpl$3$1(),
    _el$1 = _el$0.firstChild,
    _el$10 = _el$1.firstChild,
    _el$11 = _el$1.nextSibling,
    _el$12 = _el$11.firstChild,
    _el$13 = _el$12.nextSibling,
    _el$14 = _el$13.firstChild;
  _el$10.$$click = () => props.edit({});
  insert(_el$0, createComponent(For, {
    get each() {
      return [{
        name: "all feeds",
        urls: props.feeds.map(feed => feed.url)
      }].concat(tags(props.feeds));
    },
    children: category => createComponent(Category, {
      get title() {
        return category.name;
      },
      get selected() {
        return memo(() => props.selected.length > 1)() && props.selected.join() === category.urls.join();
      },
      select: () => props.select(category.urls),
      get count() {
        return category.urls.map(url => size(props.articles[url], props.read)).reduce((a, b) => a + b, 0);
      }
    })
  }), _el$11);
  insert(_el$0, createComponent(For, {
    get each() {
      return props.feeds;
    },
    children: feed => createComponent(MenuItem, mergeProps(feed, {
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
  }), _el$11);
  _el$12.$$click = () => props.set({
    dark: !props.settings.dark
  });
  _el$13.$$click = () => props.configure('Login');
  createRenderEffect(_p$ => {
    var _v$ = !!props.settings.invert,
      _v$2 = props.error ? 'fa fa-wrench' : 'fa fa-cogs';
    _v$ !== _p$.e && _el$0.classList.toggle("dark", _p$.e = _v$);
    _v$2 !== _p$.t && (_el$14.className = _p$.t = _v$2);
    return _p$;
  }, {
    e: undefined,
    t: undefined
  });
  return _el$0;
})();
delegateEvents(["click"]);

var _tmpl$$5 = /*#__PURE__*/template(`<header class="flex shadow"><div><span class="fa fa-search icon"></span><input type=text placeholder=search></div><nav class="flex buttons"><button title="mark all articles as read"><span class="fa fa-eye"></span></button><button title="show read articles"><span></span></button><button title="expand articles"><span>`);
const Header = props => (() => {
  var _el$ = _tmpl$$5(),
    _el$2 = _el$.firstChild,
    _el$3 = _el$2.firstChild,
    _el$4 = _el$3.nextSibling,
    _el$5 = _el$2.nextSibling,
    _el$6 = _el$5.firstChild,
    _el$7 = _el$6.nextSibling,
    _el$8 = _el$7.firstChild,
    _el$9 = _el$7.nextSibling,
    _el$0 = _el$9.firstChild;
  _el$4.$$input = event => props.search(event.target.value.toLowerCase());
  addEventListener(_el$6, "click", props.markall, true);
  _el$7.$$click = () => props.set({
    showread: !props.showread
  });
  _el$9.$$click = () => props.set({
    layout: !props.layout
  });
  createRenderEffect(_p$ => {
    var _v$ = props.showread ? 'fa fa-toggle-on' : 'fa fa-toggle-off',
      _v$2 = props.layout ? 'fa fa-folder-open-o' : 'fa fa-folder-o';
    _v$ !== _p$.e && (_el$8.className = _p$.e = _v$);
    _v$2 !== _p$.t && (_el$0.className = _p$.t = _v$2);
    return _p$;
  }, {
    e: undefined,
    t: undefined
  });
  return _el$;
})();
delegateEvents(["input", "click"]);

var _tmpl$$4 = /*#__PURE__*/template(`<dialog open><div class="dark edit"><main class="column grow"><h2></h2><div><input id=title placeholder=Title type=text></div><div><input id=url placeholder=Link type=url></div><div><input id=tags placeholder=Tags type=text></div><div><p><button class=red><span class="icon fa fa-trash"></span>Delete</button></p><p><button class=blue style="margin:0 1em"><span class="icon fa fa-times-circle"></span>Cancel</button><button class=green><span class="icon fa fa-floppy-o"></span>Save`);
const values = () => [{
  title: document.querySelector('#title').value,
  url: document.querySelector('#url').value,
  tags: document.querySelector('#tags').value.split(', ').filter(tag => tag)
}];
const Edit = props => (() => {
  var _el$ = _tmpl$$4(),
    _el$2 = _el$.firstChild,
    _el$3 = _el$2.firstChild,
    _el$4 = _el$3.firstChild,
    _el$5 = _el$4.nextSibling,
    _el$6 = _el$5.firstChild,
    _el$7 = _el$5.nextSibling,
    _el$8 = _el$7.firstChild,
    _el$9 = _el$7.nextSibling,
    _el$0 = _el$9.firstChild,
    _el$1 = _el$9.nextSibling,
    _el$10 = _el$1.firstChild,
    _el$11 = _el$10.firstChild,
    _el$12 = _el$10.nextSibling,
    _el$13 = _el$12.firstChild,
    _el$14 = _el$13.nextSibling;
  _el$.$$click = () => props.replace([]);
  _el$2.$$click = event => event.stopPropagation();
  insert(_el$4, () => props.old.title || 'Subscribe');
  _el$11.$$click = () => props.replace([], props.old);
  _el$13.$$click = () => props.replace([]);
  _el$14.$$click = () => props.replace(values(), props.old);
  createRenderEffect(() => _el$6.value = props.old.title || '');
  createRenderEffect(() => _el$8.value = props.old.url || '');
  createRenderEffect(() => _el$0.value = props.old.tags ? props.old.tags.join(', ') : '');
  return _el$;
})();
delegateEvents(["click"]);

var _tmpl$$3 = /*#__PURE__*/template(`<time>`);
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
  const str = value + '\u00A0' + unit.name + (value > 1 ? 's' : '');
  return delta > 0 ? str + '\u00A0ago' : 'in\u00A0' + str;
};
setInterval(() => document.querySelectorAll('time').forEach(time => time.innerHTML = toRelative(Date.parse(time.dateTime))), 30000);
const Time = ({
  time,
  className
}) => (() => {
  var _el$ = _tmpl$$3();
  _el$.className = className;
  setAttribute(_el$, "datetime", time);
  insert(_el$, () => toRelative(time));
  createRenderEffect(() => setAttribute(_el$, "title", time.toLocaleString()));
  return _el$;
})();

var _tmpl$$2 = /*#__PURE__*/template(`<div class=content><div class=flex><span class=meta></span><button title="mark as unread"class="fa fa-eye-slash"></button></div><div>`),
  _tmpl$2$1 = /*#__PURE__*/template(`<article class=shadow><header class=flex><a target=_blank>`);
const Article = props => {
  const [open, setState] = createSignal(false);
  const close = isread => {
    open() && props.mark(props.article.id, isread);
    setState(!open());
  };
  return (() => {
    var _el$ = _tmpl$2$1(),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild;
    _el$.$$click = () => close(true);
    _el$3.$$click = () => close(true);
    insert(_el$3, createComponent(Favicon, {
      get src() {
        return props.article.link;
      }
    }), null);
    insert(_el$3, () => props.article.title, null);
    insert(_el$2, createComponent(Time, {
      className: "meta",
      get time() {
        return new Date(props.article.date);
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return open() || props.open;
      },
      get children() {
        var _el$4 = _tmpl$$2(),
          _el$5 = _el$4.firstChild,
          _el$6 = _el$5.firstChild,
          _el$7 = _el$6.nextSibling,
          _el$8 = _el$5.nextSibling;
        _el$4.$$click = event => event.stopPropagation();
        insert(_el$6, () => props.article.author);
        _el$7.$$click = () => close(false);
        createRenderEffect(() => _el$8.innerHTML = props.article.content);
        return _el$4;
      }
    }), null);
    createRenderEffect(_p$ => {
      var _v$ = props.article.link,
        _v$2 = !!props.isread;
      _v$ !== _p$.e && setAttribute(_el$3, "href", _p$.e = _v$);
      _v$2 !== _p$.t && _el$3.classList.toggle("meta", _p$.t = _v$2);
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })();
};
delegateEvents(["click"]);

var _tmpl$$1 = /*#__PURE__*/template(`<a>`),
  _tmpl$2 = /*#__PURE__*/template(`<div class=overflow>`),
  _tmpl$3 = /*#__PURE__*/template(`<h2 class=center>`);
const background = props => {
  if (!props.feeds.length) return 'Welcome';
  if (props.loading) return 'Loading ...';
  if (props.selected.length === 1 && !props.articles[props.selected[0]]) return ["Loading feed from ", (() => {
    var _el$ = _tmpl$$1();
    insert(_el$, () => props.selected[0]);
    createRenderEffect(() => setAttribute(_el$, "href", props.selected[0]));
    return _el$;
  })(), " failed"];
  if (props.searching) return 'Nothing found ...';
  return 'No new articles available';
};
const articles = props => props.selected.flatMap(feed => props.articles[feed] || []).filter(props.searching ? article => ['title', 'author', 'content'].some(prop => (article[prop] || '').toLowerCase().includes(props.searching)) : !props.settings.showread ? article => !props.read[article.id] : () => true).sort((a, b) => b.date - a.date);
const Articles = props => (() => {
  var _el$2 = _tmpl$2();
  insert(_el$2, createComponent(For, {
    get each() {
      return articles(props);
    },
    get fallback() {
      return (() => {
        var _el$3 = _tmpl$3();
        insert(_el$3, () => background(props));
        return _el$3;
      })();
    },
    children: article => createComponent(Article, {
      article: article,
      get isread() {
        return props.read[article.id];
      },
      get open() {
        return props.settings.layout;
      },
      get mark() {
        return props.mark;
      }
    })
  }));
  return _el$2;
})();

var _tmpl$ = /*#__PURE__*/template(`<div><div class="main column grow overflow">`);
const App = props => (() => {
  var _el$ = _tmpl$(),
    _el$2 = _el$.firstChild;
  _el$.addEventListener("dragover", () => props.configure('Feeds'));
  insert(_el$, createComponent(Show, {
    get when() {
      return props.editing;
    },
    get children() {
      return [createComponent(Edit, {
        get old() {
          return props.editing;
        },
        get replace() {
          return props.replace;
        }
      }), "}"];
    }
  }), _el$2);
  insert(_el$, createComponent(Show, {
    get when() {
      return props.configuring;
    },
    get children() {
      return createComponent(Settings, props);
    }
  }), _el$2);
  insert(_el$, createComponent(Menu, props), _el$2);
  insert(_el$2, createComponent(Header, mergeProps(() => props.settings, {
    get set() {
      return props.set;
    },
    get search() {
      return props.search;
    },
    get markall() {
      return props.markall;
    }
  })), null);
  insert(_el$2, createComponent(Articles, props), null);
  createRenderEffect(() => _el$.className = `flex shadow ${props.settings.dark ? 'dark' : 'light'}`);
  return _el$;
})();

const [state, setState] = createStore(api.init());
const actions = {
  select: selected => setState({
    selected
  }),
  edit: editing => setState({
    editing
  }),
  search: searching => setState({
    searching
  }),
  configure: configuring => setState({
    configuring
  }),
  throwerror: error => setState({
    error
  }),
  set: changed => {
    setState('settings', changed);
    api.save('settings', state.settings).catch(actions.throwerror);
  },
  replace: (updated, old, discard) => {
    const feeds = discard ? updated : updated.concat(state.feeds.filter(feed => feed !== old)).filter((feed, index, self) => self.map(feed => feed.url).indexOf(feed.url) === index);
    setState({
      feeds,
      editing: false,
      selected: false
    });
    api.save('feeds', state.feeds).catch(actions.throwerror);
    actions.fetch();
  },
  mark: (id, isread) => {
    setState('read', id, isread);
    api.save('read', state.read).catch(actions.throwerror);
  },
  markall: () => {
    (state.selected || state.feeds.map(feed => feed.url)).flatMap(url => state.articles[url]).forEach(article => setState('read', article.id, 1));
    api.save('read', state.read).catch(actions.throwerror);
  },
  fetch: () => Promise.all(state.feeds.map(feed => api.articles(feed.url).then(articles => articles.slice(0, state.settings.load)).then(articles => {
    if (articles[feed.url] && state.settings.notify) api.notify(feed, articles.filter(article => state.articles[feed.url].every(current => current.id !== article.id)));
    setState('articles', feed.url, articles);
    return articles;
  }).catch(error => [])))
};
api.load().then(updated => {
  setState(updated);
  actions.fetch().then(articles => {
    setState({
      loading: false,
      read: Object.fromEntries(articles.flat().filter(article => state.read[article.id]).map(article => [article.id, 1]))
    });
    setInterval(actions.fetch, 60000 * state.settings.frequency);
  });
}).catch(error => {
  setState({
    error,
    configuring: 'Login'
  });
});
window.onunload = () => {
  localStorage.setItem('state', state.settings.cache ? JSON.stringify(state) : '');
};
render(() => createComponent(App, mergeProps(state, actions, {
  get selected() {
    return state.selected || state.feeds.map(feed => feed.url);
  }
})), document.body);
