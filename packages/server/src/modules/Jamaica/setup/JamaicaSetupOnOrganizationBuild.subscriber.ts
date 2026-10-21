import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { IOrganizationBuildEventPayload } from '@/modules/Organization/Organization.types';
import { JamaicaSetupService } from './JamaicaSetup.service';

@Injectable()
export class JamaicaSetupOnOrganizationBuildSubscriber {
  constructor(private readonly setupService: JamaicaSetupService) {}

  /**
   * Runs the Jamaica setup once an organization located in Jamaica is built.
   * @param {IOrganizationBuildEventPayload}
   */
  @OnEvent(events.organization.build)
  async setupJamaicaOnBuild({ buildDTO }: IOrganizationBuildEventPayload) {
    if (buildDTO?.location !== 'JM') return;

    await this.setupService.setup();
  }
}
