import * as path from 'path';
import { Command, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import '@/utils/moment-mysql';
import { AppModule } from '@/modules/App/App.module';
import { JamaicaSetupService } from '@/modules/Jamaica/setup/JamaicaSetup.service';
import { BaseCommand } from './BaseCommand';

interface TenantsJamaicaSetupOptions {
  tenant?: string;
  all?: boolean;
  dryRun?: boolean;
}

@Injectable()
@Command({
  name: 'tenants:jamaica-setup',
  description:
    'Configure organizations for a Jamaican sole trader (GCT rates, accounts, settings). Idempotent.',
})
export class TenantsJamaicaSetupCommand extends BaseCommand {
  constructor(configService: ConfigService) {
    super(configService);
  }

  @Option({
    flags: '-t, --tenant <organizationId>',
    description: 'The organization id to set up.',
  })
  parseTenant(val: string): string {
    return val;
  }

  @Option({
    flags: '-a, --all',
    description: 'Set up all initialized organizations.',
  })
  parseAll(_val: string): boolean {
    return true;
  }

  @Option({
    flags: '--dry-run',
    description: 'Report the changes without applying them.',
  })
  parseDryRun(_val: string): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: TenantsJamaicaSetupOptions,
  ): Promise<void> {
    if (!options.tenant && !options.all) {
      this.exit(new Error('Pass --tenant <organizationId> or --all.'));
      return;
    }
    const sysKnex = this.initSystemKnex();

    try {
      const tenants = await this.getAllInitializedTenants(sysKnex);
      const targets = options.all
        ? tenants
        : tenants.filter((t: any) => t.organizationId === options.tenant);

      if (targets.length === 0) {
        throw new Error(`No initialized organization: ${options.tenant}`);
      }
      const serverRoot = process.cwd();
      global.__public_dirname = path.join(serverRoot, 'public');
      global.__static_dirname = path.join(serverRoot, 'static');
      global.__views_dirname = path.join(global.__static_dirname, '/views');
      global.__images_dirname = path.join(global.__static_dirname, '/images');

      const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
      });
      const cls = app.get(ClsService);
      const setupService = app.get(JamaicaSetupService);

      for (const tenant of targets) {
        const report = await cls.run(async () => {
          cls.set('organizationId', tenant.organizationId);
          return setupService.setup(!!options.dryRun);
        });
        console.log(
          `\n${tenant.organizationId}${options.dryRun ? ' (dry run)' : ''}`,
        );
        console.log(JSON.stringify(report, null, 2));
      }
      await app.close();
      await sysKnex.destroy();
      this.success('Jamaica setup completed.');
    } catch (error) {
      await sysKnex.destroy();
      this.exit(error);
    }
  }
}
