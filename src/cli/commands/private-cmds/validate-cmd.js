/** @flow */
import chalk from 'chalk';
import Command from '../../command';
import { validate } from '../../../api/scope';
import type { ValidateResult } from '../../../scope/component-ops/validate';

export default class Validate extends Command {
  name = 'validate [path]';
  private = true;
  description = 'returns all the validation errors on a specific scope';
  alias = '';
  opts = [];

  action([path]: [string]): Promise<ValidateResult> {
    return validate(path);
  }
  report(validateResult: ValidateResult): string {
    if (validateResult.validationErrors.length === 0) {
      const output = chalk.green('Scop is valid');
      return output;
    }
    let output = chalk.red('The following errors exist in scope:\n');
    const errorMsgs = validateResult.validationErrors.map((validationError) => {
      const errorMsg = chalk.bold(validationError);
      return errorMsg;
    });
    output += errorMsgs.join('\n');
    return output;
  }
}
