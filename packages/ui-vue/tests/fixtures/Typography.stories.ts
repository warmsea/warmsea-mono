import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Heading, Text, Button } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Typography',
  id: 'wui-contract-typography',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const Scopes: StoryObj = {
  render: () => ({
    components: { Heading, Text, Button },
    setup() {
      const levels = [1, 2, 3, 4, 5, 6] as const;
      const weights = ['regular', 'semibold'] as const;

      return { levels, weights };
    },
    template: `<main class="wui-contract"><h1>Typography contracts</h1>
<Button data-testid="typography-before">Before typography</Button>
    <section id="typography" aria-label="Typography examples">
      <div id="typography-matrix" class="typography-stack">
        <Heading v-for="level in levels" :key="level" :level="level">
          Level {{ level }}: Explore the coast
        </Heading>
        <Text data-testid="text-default">A quiet place to begin.</Text>
        <Text
          v-for="weight in weights"
          :key="weight"
          :weight="weight"
          :data-testid="\`text-\${weight}\`"
        >
          {{ weight }}: Discover your next destination.
        </Text>
        <Text data-testid="text-inline-parent">
          Explore
          <Text as="span" weight="semibold" data-testid="text-inline"
            >Warmsea</Text
          >
          and <a href="#typography" data-testid="text-link">find your coast</a>.
        </Text>
      </div>
      <div
        class="typography-stack typography-scoped"
        data-testid="typography-outer"
      >
        <Heading :level="2" data-testid="heading-outer"
          >An editorial coastline</Heading
        >
        <Text data-testid="text-outer">Outer scope typography.</Text>
        <div class="typography-stack typography-inner">
          <Heading :level="3" data-testid="heading-inner"
            >A quieter inlet</Heading
          >
          <Text data-testid="text-inner"
            >Inherited size, nested weight and color.</Text
          >
        </div>
      </div>
      <Text class="typography-wrap" data-testid="text-wrap">
        A quiet coastline invites a slower journey with room to explore and
        discover a new destination.
      </Text>
    </section>
<Button data-testid="counter">After typography</Button>
    </main>`,
  }),
};
