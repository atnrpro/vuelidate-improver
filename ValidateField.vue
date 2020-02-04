<script>
import toPath from 'lodash/toPath';
import { serverValidityRuleKey } from './validationMixin';

const passwordMinLength = 6;
const errorsTexts = { // TODO how to make it customizeble?
  required: 'Заполните поле',
  email: 'Неверный формат',
  sameAs: 'Пароли не совпадают',
  minLength: `Пароль должен быть не менее ${passwordMinLength} символов`,
};
const defaultErrorText = 'Ошибка!';

export default {
  name: 'ValidateField',
  inject: {
    getValidationByPath: {
      default: () => () => {},
    },
    getServerErrorTextFor: {
      default: () => () => {},
    },
    getValidationProxyPath: {
      default: () => () => '',
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
        validationPath: this.validationPath, // TODO still we need it?
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
      return proxyPath !== '' ? `${proxyPath}.${this.path}` : this.path;
    },
    serverError() {
      return { [serverValidityRuleKey]: this.getServerErrorTextFor(this.validationPath, this.name) };
    },
    errorMessage() {
      const validationDoesntExist = !this.validationByPath;
      if (validationDoesntExist) {
        return null;
      }
      const rulesKeys = Object.keys(this.validationByPath.$params);
      const invalidKey = rulesKeys.find(k => !this.validationByPath[k]);
      if (!invalidKey) {
        return null;
      }
      return this.serverError[invalidKey] || this.customErrorsTexts[invalidKey] || errorsTexts[invalidKey] || defaultErrorText;
    },
    showError() {
      return !!this.errorMessage && this.validationByPath.$dirty;
    },
  },
  render() { // TODO use normalizeChildren helper instead of it
    if (this.$scopedSlots.default) {
      return this.$scopedSlots.default(this.fieldProps) || null;
    }

    return this.$slots.default || []; // TODO should we throw error if there is nothing to render? If child component has conditional rendering there can be a problem if we throw an error
  },
};
</script>
