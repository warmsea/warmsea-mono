import { addons } from 'storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    showPanel: ({ storyId }, defaultValue) =>
      [
        'warmsea-menu--demos',
        'warmsea-app-bar--demos',
        'warmsea-button--demos',
        'warmsea-heading--demos',
        'warmsea-select--demos',
        'warmsea-input--demos',
        'warmsea-textarea--demos',
        'warmsea-dialog--demos',
        'warmsea-text--demos',
        'warmsea-tooltip--demos',
      ].includes(storyId ?? '')
        ? false
        : defaultValue,
  },
});
