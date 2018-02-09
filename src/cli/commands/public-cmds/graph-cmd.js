/** @flow */
import chalk from 'chalk';
import Command from '../../command';
import { generateGraph } from '../../../api/scope';

export default class Graph extends Command {
  name = 'graph [scopePath]';
  description = 'generate dependencies graph';
  private = true;
  alias = '';
  opts = [['i', 'image <image>', 'image path']];

  action([scopePath]: [string], options: { image: ?string }): Promise<any> {
    return generateGraph(scopePath || process.cwd(), options);
  }

  report(result: string): string {
    return chalk.green(`image created at ${result}`);
  }
}
