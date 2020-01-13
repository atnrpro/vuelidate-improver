<script>
import toPath from 'lodash/toPath';

const passwordMinLength = 6;
const errorsTexts = { // TODO how to make it customizeble?
  required: 'Заполните поле',
  email: 'Неверный формат',
  sameAs: 'Пароли не совпадают',
  minLength: `Пароль должен быть не менее ${passwordMinLength} символов`,
};

export default {
  name: 'ValidateField',
  inject: {
    getValidationByPath: {
      default: () => () => {},
    },
    getCustomServerErrorTextFor: {
      default: () => () => {},
    },
    getValidationProxyPath: {
      default: '',
    },
  },
  props: {
    path: {
      type: String,
      required: true,
    },
    customErrorsTexts: {
      type: Object,
      default: () => ({}),
    },
  },
  computed: {
    fieldProps() {
      return {
        errorMessage: this.errorMessage,
        showError: this.showError,
        validation: this.validationByPath,
        validationPath: this.validationPath,
      };
    },
    name() {
      const pathArray = toPath(this.path);
      return pathArray[pathArray.length - 1];
    },
    validationByPath() {
      return this.getValidationByPath(this.path);
    },
    validationPath() {
      const proxyPath = this.getValidationProxyPath();
      return proxyPath !== '' ? `${this.getValidationProxyPath()}.${this.path}` : this.path;
    },
    customServerError() {
      return this.getCustomServerErrorTextFor(this.validationPath, this.name) || {};
    },
    customErrors() {
      return Object.assign({}, this.customServerError, this.customErrorsTexts);
    },
    errorMessage() {
      if (!this.validationByPath) {
        return null;
      }
      const keys = Object.keys(this.validationByPath.$params);
      const invalidKey = keys.find(k => !this.validationByPath[k]);
      if (!invalidKey) {
        return null;
      }
      return this.customErrors[invalidKey] || errorsTexts[invalidKey] || 'Ошибка!';
    },
    showError() {
      return !!this.errorMessage && this.validationByPath.$dirty;
    },
  },
  render() {
    if (this.$scopedSlots.default) {
      return this.$scopedSlots.default(this.fieldProps) || null;
    }

    return this.$slots.default || [];
  },
};
</script>
