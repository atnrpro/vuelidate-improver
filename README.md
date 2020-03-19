# vuelidate-improver
[![dependencies Status](https://david-dm.org/atnrpro/vuelidate-improver/status.svg)](https://david-dm.org/atnrpro/vuelidate-improver)

## Demo

[Example](https://codesandbox.io/s/vuelidate-improver-pnkrh)

## Installation

```bash
  npm i --save vuelidate-improver
```

```bash
  yarn add vuelidate-improver
```

You can import the library and use as a Vue plugin to enable the functionality globally on all components containing validation configuration.

```javascript
import Vue from 'vue'
import VuelidateImprover from 'vuelidate-improver'
import Vuelidate from 'vuelidate'
Vue.use(VuelidateImprover);
Vue.use(Vuelidate)
```

Alternatively it is possible to import a mixin directly to components in which it will be used.

```javascript
import { validationMixin } from 'vuelidate'
import { validationImproverMixin } from 'vuelidate-improver'

var Component = Vue.extend({
  mixins: [validationImproverMixin, validationMixin],
  validations: { ... }
})
```
