/** @flow */
import type { ValidateResult } from '../../../scope/component-ops/validate';
import getValidations from '../../../scope/component-ops/validate';
import { loadScope, Scope } from '../../../scope';

export default (async function validate(path: string): Promise<ValidateResult> {
  const scope: Scope = await loadScope(path);
  return getValidations(scope);
});
