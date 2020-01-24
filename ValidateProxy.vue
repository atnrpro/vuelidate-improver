<script>
import { normalizeChildren } from './utils'

export default {
  name: 'ValidateProxy',
  inject: {
    getParentValidationByPath: {
      from: "getValidationByPath",
    },
    getParentValidationProxyPath: {
      from: "getValidationProxyPath",
      default: () => () => {},
    }
  },
  props: {
    path: {
      type: String,
      required: true,
    },
    slim: {
      type: Boolean,
      default: false,
    },
    tag: {
      type: String,
      default: 'div'
    },
  },
  computed: {
    slotProps() {
      return {
        fullPath: this.fullProxyPath,
      };
    },
    fullProxyPath() {
      const parentProxyPath = this.getParentValidationProxyPath();
      return parentProxyPath
        ? `${parentProxyPath}.${this.path}`
        : this.path;
    },
  },
  provide() {
    return {
      getValidationByPath: path => this.getParentValidationByPath(`${this.path}.${path}`),
      getValidationProxyPath: () => this.fullProxyPath,
    };
  },
  render(h) {
    const children = normalizeChildren(this, this.slotProps);

    return this.slim && children.length <= 1 ? children[0] : h(this.tag, { on: this.$listeners }, children);
  },
};
</script>
