import { ComponentAspect, ComponentUI } from '@teambit/component';
import { Slot, SlotRegistry } from '@teambit/harmony';
import type { TitleBadge } from '@teambit/component.ui.component-meta';
import { UIRuntime } from '@teambit/ui';

import { DocsAspect } from './docs.aspect';
import { OverviewSection } from './overview.section';

export type TitleBadgeSlot = SlotRegistry<TitleBadge>;

export class DocsUI {
  constructor(private titleBadgeSlot: TitleBadgeSlot) {}

  /**
   * register a new title badge into the overview section of a component.
   */
  registerTitleBadge(titleBadge: TitleBadge) {
    this.titleBadgeSlot.register(titleBadge);
    return this;
  }

  /**
   * list all title badges registered.
   */
  listTitleBadges() {
    return this.titleBadgeSlot.values();
  }

  static dependencies = [ComponentAspect];

  static runtime = UIRuntime;

  static slots = [Slot.withType<TitleBadge>()];

  static async provider([component]: [ComponentUI], config, [titleBadgeSlot]: [TitleBadgeSlot]) {
    const docs = new DocsUI(titleBadgeSlot);
    const section = new OverviewSection(docs);

    component.registerRoute(section.route);
    component.registerNavigation(section.navigationLink, section.order);

    return docs;
  }
}

export default DocsUI;

DocsAspect.addRuntime(DocsUI);
