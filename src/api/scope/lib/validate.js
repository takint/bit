/** @flow */
import type { ValidateResult } from '../../../scope/component-ops/validate';
import getValidations from '../../../scope/component-ops/validate';
import { loadScope, Scope } from '../../../scope';

export default (async function validate(): Promise<ValidateResult> {
  const scope: Scope = await loadScope(process.cwd());
  return getValidations(scope);
});
