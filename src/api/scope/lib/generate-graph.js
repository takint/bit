/** @flow */
import { loadScope } from '../../../scope';

export default (async function generateGraph(path: string, options: Object): Promise<string> {
  const scope = await loadScope(path);
  const visualDependencyGraph = await scope.visualDependencyGraph;
  const { image } = options;
  return await visualDependencyGraph.image(image);
});
