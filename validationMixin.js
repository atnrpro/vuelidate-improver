import get from "lodash/get";
import set from "lodash/set";
import toPath from "lodash/toPath";
import { withParams } from "vuelidate/lib/validators/common";

export const serverValidityRuleKey = "serverValidity"; // TODO give user ability to customize

let _cachedVue = null;
function getVue(rootVm) {
  if (_cachedVue) return _cachedVue;
  let Vue = rootVm.constructor;
  while (Vue.super) {
    Vue = Vue.super;
  }
  _cachedVue = Vue;
  return Vue;
}

let _cachedComponent = null;
const getComponent = Vue => {
  if (_cachedComponent) {
    return _cachedComponent;
  }

  const component = Vue.extend({
    data: () => ({
      serverPaths: [],
      serverMap: {},
      serverFieldErrors: {}
    }),
    computed: {
      validation() {
        return this.model.$v;
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
            const observable = get(this.model, path);
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

  _cachedComponent = component;
  return _cachedComponent;
};

const validateModel = (model, settings) => {
  const Vue = getVue(model);
  const component = getComponent(Vue);
  return new component({
    data: () => ({
      ...settings
    }),
    computed: {
      model() {
        return model;
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
export const validationServerMixin = {
  data() {
    const settings = this.$options.validationSettings || {};
    if (this.$options.validations || !!settings.serverPaths) {
      this._validationSettings = validateModel(this, settings);
    }
    return {};
  },
  beforeCreate() {
    const options = this.$options;
    const settings = options.validationSettings || {};
    if (!options.validations && !settings.serverPaths) return;
    const Vue = getVue(this);
    options.validations = Vue.config.optionMergeStrategies.provide(
      options.validations,
      function() {
        if (this.$validationHelper) {
          return this._validationSettings.getValidations();
        }
      },

      this
    );
    if (!options.computed) options.computed = {};
    if (options.computed.$validationHelper) return;
    options.computed.$validationHelper = function() {
      return this._validationSettings ? this._validationSettings.proxy : null;
    };
  },
  beforeDestroy() {
    if (this._validationSettings) {
      this._validationSettings.$destroy();
      this._validationSettings = null;
    }
  },
  provide() {
    const settings = this.$options.validationSettings || {};
    const getValidationProxyPath = () => {
      return (
        (typeof settings.proxyPath === "function"
          ? settings.proxyPath.call(this)
          : settings.proxyPath) || ""
      );
    };
    if (this.$validationHelper) {
      return {
        getValidationByPath: path => {
          if (settings.proxyPath) {
            path = `${getValidationProxyPath()}.${path}`;
          }
          return this.$validationHelper.getValidationByPath(path);
        },
        getCustomServerErrorTextFor: this.$validationHelper.getErrorTextFor,
        getValidationProxyPath: getValidationProxyPath
      };
    }
    if (settings.proxyPath && this.getPreviewValidationByPath) {
      return {
        getValidationByPath: path => {
          const proxyPath = getValidationProxyPath();
          return this.getPreviewValidationByPath(`${proxyPath}.${path}`);
        },
        getValidationProxyPath: () => {
          const proxyPath = getValidationProxyPath();
          const previewProxyPath = this.getPreviewValidationProxyPath();
          return previewProxyPath
            ? `${previewProxyPath}.${proxyPath}`
            : proxyPath;
        }
      };
    }
    return {};
  },
  inject: {
    getPreviewValidationByPath: {
      from: "getValidationByPath",
      default: null
    },
    getPreviewValidationProxyPath: {
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
