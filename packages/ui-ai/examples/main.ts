import {
  createApp,
  defineComponent,
  h,
  ref,
  Teleport,
  withModifiers,
} from 'vue';
import { ChatInput, type ChatInputSlotState } from '@warmsea/ui-ai';
import '@warmsea/ui-tokens/style.css';
import '@warmsea/ui-vue/style.css';
import '@warmsea/ui-ai/style.css';
import Demo from '../src/components/chat-input/ChatInput.demo.vue';
const NativeExample = defineComponent({
  setup() {
    const query = new URLSearchParams(location.search);
    const draft = ref(query.has('required') ? '' : '  Controlled draft  ');
    const disabled = ref(query.has('fieldset'));
    const destination = ref('disabled');
    const enabledFieldsetDisabled = ref(false);
    const disabledFieldsetDisabled = ref(true);
    const submitted = ref<string[]>([]);
    const resets = ref(0);
    const cancelled = ref(false);
    const renderChatInput = () =>
      h(
        ChatInput,
        {
          modelValue: draft.value,
          label: 'Native message',
          submitLabel: 'Native send',
          canSubmit: true,
          disabled: disabled.value,
          required: query.has('required'),
          form: 'external',
          'onUpdate:modelValue': (value: string) => (draft.value = value),
          onSubmit: (value: string) => submitted.value.push(value),
          onReset: withModifiers(
            (event: Event) => {
              resets.value++;
              cancelled.value = event.defaultPrevented;
              if (query.has('clear')) draft.value = '';
            },
            ['prevent'],
          ),
        },
        {
          'actions-end': ({ disabled, canSubmit }: ChatInputSlotState) => [
            h('button', { type: 'reset', disabled }, 'Reset draft'),
            h(
              'output',
              { 'data-testid': 'slot-state' },
              `${disabled}/${canSubmit}`,
            ),
          ],
        },
      );
    return () =>
      h('main', [
        h('h1', 'Native controlled prompt example'),
        h('form', { id: 'external' }),
        h(
          'button',
          { onClick: () => (disabled.value = !disabled.value) },
          'Toggle local disabled',
        ),
        ...(query.has('teleport')
          ? [
              ...['enabled', 'disabled', 'first legend'].map((name) =>
                h(
                  'button',
                  {
                    onClick: () =>
                      (destination.value =
                        name === 'first legend' ? 'legend' : name),
                  },
                  `Move to ${name}`,
                ),
              ),
              h(
                'button',
                {
                  onClick: () => {
                    if (destination.value === 'enabled')
                      enabledFieldsetDisabled.value =
                        !enabledFieldsetDisabled.value;
                    else
                      disabledFieldsetDisabled.value =
                        !disabledFieldsetDisabled.value;
                  },
                },
                'Toggle destination fieldset',
              ),
              h('fieldset', { disabled: enabledFieldsetDisabled.value }, [
                h('legend', 'Enabled destination'),
                h('div', { id: 'native-destination-enabled' }),
              ]),
              h('fieldset', { disabled: disabledFieldsetDisabled.value }, [
                h('legend', [
                  'Disabled destination',
                  h('div', { id: 'native-destination-legend' }),
                ]),
                h('div', { id: 'native-destination-disabled' }),
              ]),
              h(
                Teleport,
                { to: `#native-destination-${destination.value}`, defer: true },
                [renderChatInput()],
              ),
            ]
          : [
              h('fieldset', { disabled: query.has('fieldset') }, [
                h(
                  'legend',
                  query.has('legend') ? [renderChatInput()] : 'Prompt',
                ),
                ...(query.has('legend') ? [] : [renderChatInput()]),
              ]),
            ]),
        h(
          'output',
          { 'data-testid': 'resets' },
          `${resets.value}/${cancelled.value}`,
        ),
        h(
          'output',
          { 'data-testid': 'submissions' },
          JSON.stringify(submitted.value),
        ),
      ]);
  },
});
createApp(
  new URLSearchParams(location.search).has('native') ? NativeExample : Demo,
).mount('#app');
