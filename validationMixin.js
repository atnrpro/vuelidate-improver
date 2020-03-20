import get from 'lodash/get';
import set from 'lodash/set';
import toPath from 'lodash/toPath';
import { withParams } from 'vuelidate/lib/validators/common';

export const serverValidityRuleKey = 'serverValidity'; // TODO give user ability to customize
const _cache = {
  Vue: null,
  ValidityStateComponent: null,
};

function getVue(rootVm) {
  if (_cache.Vue) {
    return _cache.Vue;
  }
  let Vue = rootVm.constructor;
  while (Vue.super) {
    Vue = Vue.super;
  }
  _cache.Vue = Vue;
  return Vue;
}

const getValidityStateComponentConstructor = Vue => {
  // компонент с валидацией, который имеет ссылку на валидируемый компонент и нужен, чтоб не хранить эти поля в валидируемом объекте
  if (_cache.ValidityStateComponent) {
    return _cache.ValidityStateComponent;
  }

  const component = Vue.extend({
    data: () => ({
      serverPaths: [], // TODO think how to rename it
      serverMap: {}, // TODO think how to rename it
      serverFieldErrors: {},
    }),
    computed: {
      validation() {
        return this.validatedComponent.$v;
      },
      proxy() {
        return {
          serverErrors: {
            ...this.serverFieldErrors,
          },
          setErrors: this.setErrors,
          setErrorsFor: this.setErrorsFor,
          getErrorTextFor: this.getErrorTextFor,
          getValidationByPath: this.getValidationByPath,
        };
      },
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
          if (pathArray[pathArray.length - 1] === '*') {
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
            },
          ),
        };
      },
      setErrors(errors = {}) {
        this.serverFieldErrors = errors;
      },
      setErrorsFor(field, errors) {
        this.serverFieldErrors[field] = errors;
      },
      getErrorTextFor(path, field) {
        const serverField = this.serverMap[path] || field;
        return this.serverFieldErrors && this.serverFieldErrors[serverField];
      },
    },
  });

  _cache.ValidityStateComponent = component;
  return _cache.ValidityStateComponent;
};

const createValidityStateComponent = (
  validatedComponent,
  { serverPaths = [], serverMap = {}, serverFieldErrors = {} },
) => {
  const Vue = getVue(validatedComponent);
  const ValidityStateComponent = getValidityStateComponentConstructor(Vue);
  return new ValidityStateComponent({
    data: () => ({
      serverPaths,
      serverMap,
      serverFieldErrors,
    }),
    computed: {
      validatedComponent() {
        return validatedComponent;
      },
    },
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
 */
function getValidationSettings(component) {
  return { ...component.$options.validationSettings } || {};
}

function isValidationEnabledForComponent(component) {
  const settings = getValidationSettings(component);
  return (
    !!component.$options.validations ||
    !!(settings.serverPaths && settings.serverPaths.length)
  );
}

function getProvideForRootComponent(validationHelpers) {
  return {
    getValidationByPath: validationHelpers.getValidationByPath,
    getServerErrorTextFor: validationHelpers.getErrorTextFor,
  };
}

export const validationImproverMixin = {
  beforeCreate() {
    if (!isValidationEnabledForComponent(this)) return;

    const settings = getValidationSettings(this);
    this._validityStateComponent = createValidityStateComponent(this, settings);
    const options = this.$options;
    const Vue = getVue(this);
    options.validations = Vue.config.optionMergeStrategies.validations(
      function() {
        if (this.$validationHelpers) {
          return this._validityStateComponent.getValidations();
        }
      },
      options.validations,
      this,
    );
    if (!options.computed) options.computed = {};
    if (options.computed.$validationHelpers) return;
    options.computed.$validationHelpers = function() {
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
    const isRootValidationComponent = !!this.$validationHelpers;
    if (isRootValidationComponent) {
      return getProvideForRootComponent(this.$validationHelpers);
    }
    return {};
  },
};

function validationServer(Vue) {
  Vue.config.optionMergeStrategies.validations =
    Vue.config.optionMergeStrategies.provide;
  Vue.mixin(validationImproverMixin);
}

export default validationServer;
