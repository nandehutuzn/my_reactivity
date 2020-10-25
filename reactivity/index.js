const isObject = val => val !== null && typeof val === 'object'
const convert = target => isObject(target) ? reactive(target) : target
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (target, key) => hasOwnProperty.call(target, key)

export function reactive(target) {
  if(!isObject(target)) return target

  const handler = {
    get(target, key, receiver) {
      // 收集依赖
      track(target, key)
      const result = Reflect.get(target, key, receiver)
      return convert(result)
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver)
      let result = true
      if(oldValue !== value) {
         result = Reflect.set(target, key, value, receiver)
        // 触发更新
        trigger(target, key)
      }

      return result
    },
    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key)
      const result = Reflect.deleteProperty(target, key)
      if(hadKey, result) {
        // 触发更新
        trigger(target, key)
      }

      return result
    }
  }

  return new Proxy(target, handler)
}

let activeEffect = null
export function effect(callback) {
  activeEffect = callback
  callback() // 访问响应式对象属性，去收集依赖
  activeEffect = null
}

let targetMap = new WeakMap()

export function track(target, key) {
  // 如果不是依赖收集的过程，则直接返回
  if(!activeEffect) return

  let depsMap = targetMap.get(target)
  if(!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if(!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  dep.add(activeEffect) // activeEffect 即 callback
}

export function trigger (target, key) {
  const depsMap = targetMap.get(target)
  if(!depsMap) return

  const dep = depsMap.get(key)
  if(dep) {
    dep.forEach(effect => {
      effect()
    })
  }
}

export function ref (raw) {
  // 判断raw是否是ref创建的对象 ，如果是，直接返回
  if(isObject(raw) && raw.__v_isRef) {
    return
  }

  let value = convert(raw)
  const r = {
    __v_isRef: true,
    get value() {
      track(r, 'value')
      return value
    },
    set value (newValue) {
      if(newValue !== value) {
        raw = newValue
        value = convert(raw)
        trigger(r, 'value')
      }
    }
  }

  return r
}

export function toRefs (proxy) {
  const ret = proxy instanceof Array ? new Array(proxy.length) : {}
  /* 
    传入的proxy对象每个属性已经做过响应式处理，
    这里需要解决的问题是当proxy对象属性被解构出来，
    操作某个属性是，它的响应式依然有效，
    解决办法是改变一下proxy对象最外层属性取值/赋值路径，
    当proxy某个属性被解构出来，我们把对这个值的操作转接到proxy的这个属性下即可
  */
  for(const key in proxy) {
    ret[key] = toProxyRef(proxy, key)
  }

  return ret
}

function toProxyRef(proxy, key) {
  const r = {
    __v_isRef: true,
    get value() {
      return proxy[key]
    },
    set value(newValue) {
      proxy[key] = newValue
    }
  }

  return r
}

export function computed(getter) {
  const result = ref()

  effect(() => (result.value = getter()))

  return result
}