<script>
import toPath from 'lodash/toPath';
import { serverValidityRuleKey } from './validationMixin';
import { normalizeChildren } from './utils';

const passwordMinLength = 6;
const errorsTexts = {
  // TODO how to make it customizeble? mb it doesn't need where? and use third party library? for example https://github.com/dobromir-hristov/vuelidate-error-extractor
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
      return {
        [serverValidityRuleKey]: this.getServerErrorTextFor(
          this.validationPath,
          this.name,
        ),
      };
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
      return (
        this.serverError[serverValidityRuleKey] ||
        this.customErrorsTexts[invalidKey] ||
        errorsTexts[invalidKey] ||
        defaultErrorText
      );
    },
    showError() {
      return !!this.errorMessage && this.validationByPath.$dirty;
    },
  },
  render() {
    return normalizeChildren(this, this.fieldProps);
  },
};
</script>
