// @flow
import { Scope } from '..';

export type ValidateResult = { validationErrors: string[] };

export default (async function getValidations(scope: Scope): Promise<ValidateResult> {
  const components = await scope.objects.listComponents();
  const results: ValidateResult = { validationErrors: [] };
  const errMsgs = [];
  await Promise.all(
    components.map(async function (component) {
      const versionArray = component.listVersions();
      return Promise.all(
        versionArray.map(async function (version) {
          const componentVersion = component.toComponentVersion(version);
          try {
            const modelVersion = await componentVersion.getVersion(scope.objects);
            if (modelVersion != null) {
              modelVersion.validate();
            }
            const consumerComponent = await componentVersion.toConsumer(scope.objects);
            if (consumerComponent != null) {
              consumerComponent.validateComponent();
              const componentDep = consumerComponent.dependencies;
              componentDep.validate();
              return;
            }
          } catch (ex) {
            const errMsg = `${scope.name}, ${component.id()}, ${version}, ${ex.toString()}`;
            errMsgs.push(errMsg);
          }
        })
      );
    })
  );
  results.validationErrors = errMsgs;
  return results;
});
