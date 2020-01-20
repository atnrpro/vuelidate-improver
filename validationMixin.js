import get from "lodash/get";
import set from "lodash/set";
import toPath from "lodash/toPath";
import { withParams } from "vuelidate/lib/validators/common";

export const serverValidityRuleKey = "serverValidity"; // TODO give user ability to customize
const _cache = {
  Vue: null,
  ValidityStateComponent: null
};

function getVue(rootVm) {
  // TODO can we use import Vue instead of it?
  if (_cache.Vue) return _cache.Vue;
  let Vue = rootVm.constructor;
  while (Vue.super) {
    Vue = Vue.super;
  }
  _cache.Vue = Vue;
  return Vue;
}

// TODO rename to getValidationComponent or getValidationStateComponent or getValidityStateComponentConstructor
const getValidityStateComponentConstructor = Vue => {
  // компонент с валидацией, который имеет ссылку на валидируемый компонент и нужен, чтоб не хранить эти поля в валидируемом объекте
  if (_cache.ValidityStateComponent) {
    return _cache.ValidityStateComponent;
  }

  const component = Vue.extend({
    data: () => ({
      serverPaths: [], // TODO think how to rename it
      serverMap: {}, // TODO think how to rename it
      serverFieldErrors: {}
    }),
    computed: {
      validation() {
        return this.validatedComponent.$v;
      },
      proxy() {
        return {
          serverErrors: {
            ...this.serverFieldErrors
          },
          setErrors: this.setErrors,
          setErrorsFor: this.setErrorsFor,
          getErrorTextFor: this.getErrorTextFor,
          getValidationByPath: this.getValidationByPath
        };
      }
    },
    methods: {
      getValidationByPath(path) {
        return get(this.validation, path);
      },
      /**
       * Add serverValidity on element to path and if path finish on * then add serverValidity on all first level fields
       */
      getValidations() {
        let validations = {};
        this.serverPaths.forEach(path => {
          let validation = {};
          const pathArray = toPath(path);
          if (pathArray[pathArray.length - 1] === "*") {
            path = path.slice(0, -2);
            const observable = get(this.validatedComponent, path);
            Object.keys(observable).forEach(field => {
              validation[field] = this.addValidations(`${path}.${field}`);
            });
          } else {
            validation = this.addValidations(path);
          }
          set(validations, path, validation);
        });
        return validations;
      },
      addValidations(path) {
        const pathArray = toPath(path);
        const field = pathArray[pathArray.length - 1];
        const serverField = this.serverMap[path] || field;
        return this.getValidationForField(serverField);
      },
      getValidationForField(field) {
        let lastValue;
        return {
          [serverValidityRuleKey]: withParams(
            { type: serverValidityRuleKey },
            value => {
              if (lastValue !== value && lastValue !== undefined) {
                this.setErrorsFor(field, null);
              }
              lastValue = value;
              return !(this.serverFieldErrors && this.serverFieldErrors[field]);
            }
          )
        };
      },
      setErrors(errors = {}) {
        this.serverFieldErrors = errors;
      },
      setErrorsFor(field, error) {
        this.serverFieldErrors[field] = error;
      },
      getErrorTextFor(path, field) {
        const serverField = this.serverMap[path] || field;
        return {
          [serverValidityRuleKey]:
            this.serverFieldErrors && this.serverFieldErrors[serverField]
        };
      }
    }
  });

  _cache.ValidityStateComponent = component;
  return _cache.ValidityStateComponent;
};

const createValidityStateComponent = (
  validatedComponent,
  { serverPaths = [], serverMap = {}, serverFieldErrors = {} }
) => {
  const Vue = getVue(validatedComponent);
  const ValidityStateComponent = getValidityStateComponentConstructor(Vue);
  return new ValidityStateComponent({
    data: () => ({
      serverPaths,
      serverMap,
      serverFieldErrors
    }),
    computed: {
      validatedComponent() {
        return validatedComponent;
      }
    }
  });
};

/**
 *  validationSettings has parameters:
 *  serverPaths: [] - paths to element from add serverValidity, if element is object then add serverValidity on all first level fields
 *  serverMap: {} - map field with server errors
 *    example: {
 *      form: 'formName',
 *      'form.login': 'serverLoginName'
 *    }
 *  proxyPath: '' - proxy getValidationByPath for path (using in fe/src/components/uikit/VuelidateField.vue). May be string or function => string
 *    example:
 *      form: {
 *        data: {
 *          name: 'ivan',
 *          secondName: 'ivanov'
 *        }
 *      }
 *      `proxyPath: 'form.data'` be return `{ name: 'ivan', secondName: 'ivanov' }`
 */
function getValidationSettings(component) {
  let settings = { ...component.$options.validationSettings } || {};
  Object.defineProperty(settings, "proxyPath", {
    // TODO maybe make function? because everyone wants to make destruct of proxypath :)
    get() {
      const settingsObj = component.$options.validationSettings || {}; // TODO refactor
      return (
        (typeof settingsObj.proxyPath === "function"
          ? settingsObj.proxyPath.call(component)
          : settingsObj.proxyPath) || ""
      );
    }
  });
  return settings;
}

function isValidationEnabledForComponent(component) {
  const settings = getValidationSettings(component);
  return !!component.$options.validations || !!settings.serverPaths;
}

function getProvideForRootComponent(validationHelpers, settings) {
  return {
    getValidationByPath: path => {
      if (settings.proxyPath) {
        path = `${settings.proxyPath}.${path}`;
      }
      return validationHelpers.getValidationByPath(path);
    },
    getCustomServerErrorTextFor: validationHelpers.getErrorTextFor,
    getValidationProxyPath: () => settings.proxyPath
  };
}

function getProvideForChildComponent(component, settings) {
  if (settings.proxyPath && !component.getParentValidationByPath) {
    console.error(
      "Component has proxyPath, but doesn't have a parent",
      component
    );
  }
  const isChildWithProxyPath =
    settings.proxyPath && component.getParentValidationByPath;
  if (!isChildWithProxyPath) {
    return {};
  }
  return {
    getValidationByPath: path => {
      return component.getParentValidationByPath(
        `${settings.proxyPath}.${path}`
      );
    },
    getValidationProxyPath: () => {
      const parentProxyPath = component.getParentValidationProxyPath();
      return parentProxyPath
        ? `${parentProxyPath}.${settings.proxyPath}`
        : settings.proxyPath;
    }
  };
}

export const validationServerMixin = {
  data() {
    const settings = getValidationSettings(this); // TODO move to beforeCreate if it's possible
    if (isValidationEnabledForComponent(this)) {
      this._validityStateComponent = createValidityStateComponent(
        this,
        settings // TODO maybe don't pass settings? we have everything to get it inside
      );
    }
    return {};
  },
  beforeCreate() {
    if (!isValidationEnabledForComponent(this)) return;
    const options = this.$options;
    const Vue = getVue(this);
    options.validations = Vue.config.optionMergeStrategies.provide(
      // TODO change to validations strategy
      options.validations,
      function() {
        if (this.$validationHelpers) {
          return this._validityStateComponent.getValidations();
        }
      },

      this
    );
    if (!options.computed) options.computed = {};
    if (options.computed.$validationHelpers) return;
    options.computed.$validationHelpers = function() {
      // TODO Rename to $validationHelpers or smth better
      return this._validityStateComponent
        ? this._validityStateComponent.proxy
        : null;
    };
  },
  beforeDestroy() {
    if (this._validityStateComponent) {
      this._validityStateComponent.$destroy();
      this._validityStateComponent = null;
    }
  },
  provide() {
    const settings = getValidationSettings(this);
    const isRootValidationComponent = !!this.$validationHelpers;
    if (isRootValidationComponent) {
      return getProvideForRootComponent(this.$validationHelpers, settings);
    }
    return getProvideForChildComponent(this, settings);
  },
  inject: {
    getParentValidationByPath: {
      from: "getValidationByPath",
      default: null
    },
    getParentValidationProxyPath: {
      from: "getValidationProxyPath",
      default: ""
    }
  }
};

function validationServer(Vue) {
  Vue.config.optionMergeStrategies.validations =
    Vue.config.optionMergeStrategies.provide;
  Vue.mixin(validationServerMixin);
}

export default validationServer;
