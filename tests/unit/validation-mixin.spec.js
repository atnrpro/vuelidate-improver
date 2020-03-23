import { createLocalVue, shallowMount } from '@vue/test-utils';
import { validationImproverMixin } from '../../validationMixin';
import Vuelidate from 'vuelidate';

const localVue = createLocalVue();
localVue.use(Vuelidate);

function createWrapper(options = {}, data = () => ({})) {
  return shallowMount(
    { template: '<div/>', data },
    {
      localVue,
      mixins: [validationImproverMixin],
      ...options,
    },
  );
}

describe('validationMixin', () => {
  it('Shouldn`t add $validationHelpers without settings', () => {
    const wrapper = createWrapper();
    expect(wrapper.vm.$validationHelpers).toBeUndefined();
  });

  it('Shouldn`t add $validationHelpers without serverPaths and validations', () => {
    const wrapper = createWrapper({
      validationSettings: {
        serverMap: {
          'form.user': 'username',
        },
        testData: '',
      },
    });
    expect(wrapper.vm.$validationHelpers).toBeUndefined();
  });

  it('Should define $validationHelpers if validations exist', () => {
    const wrapper = createWrapper({
      validations: {
        name: {},
      },
    });
    expect(wrapper.vm.$validationHelpers).toBeDefined();
  });

  it('Should define $validationHelpers if serverPaths exist', () => {
    const wrapper = createWrapper({
      validationSettings: {
        serverPaths: ['name'],
      },
    });
    expect(wrapper.vm.$validationHelpers).toBeDefined();
    expect(wrapper.vm.$v).toBeDefined();
  });
});
