/** @flow */
import path from 'path';
import fs from 'fs-extra';
import execa from 'execa';
import graphviz from 'graphviz';
import { Repository } from '../objects';
// import { BitId, BitIds } from '../../bit-id';
import { Component, Version } from '../models';
import { VERSION_DELIMITER } from '../../constants';
import logger from '../../logger/logger';

type ConfigProps = {
  layout: ?string, // dot Layout to use in the graph
  fontName: ?string, // Arial font name to use in the graph
  fontSize: ?string, // 14px	Font size to use in the graph
  backgroundColor: ?string, // #000000	Background color for the graph
  nodeColor: ?string, // #c6c5fe	Default node color to use in the graph
  noDependencyColor: ?string, // #cfffac	Color to use for nodes with no dependencies
  edgeColor: ?string, // #757575	Edge color to use in the graph
  graphVizOptions: ?Object, // false	Custom GraphViz options
  graphVizPath: ?string // null Custom GraphViz path
};

const defaultConfig = {
  layout: 'dot',
  fontName: 'Arial',
  fontSize: '14px',
  backgroundColor: '#000000',
  nodeColor: '#c6c5fe',
  noDependencyColor: '#cfffac',
  edgeColor: '#757575',
  graphVizOptions: null,
  graphVizPath: null
};

export default class VisualDependencyGraph {
  repository: Repository;
  graph: Any;
  config: ConfigProps;
  rawOptions: Object;

  constructor(repository: Repository, graph: Any, config: ConfigProps, rawOptions: Object) {
    this.repository = repository;
    this.graph = graph;
    this.config = config;
    this.rawOptions = rawOptions;
  }

  static async load(repository: Repository, config: ConfigProps = {}, rawOptions: Object) {
    const concreteConfig = Object.assign({}, defaultConfig, config);
    checkGraphvizInstalled(config.graphVizPath);
    const graph = await VisualDependencyGraph.buildDependenciesGraph(repository, concreteConfig);
    return new VisualDependencyGraph(repository, graph, concreteConfig, rawOptions);
  }

  /**
   * Creates the graphviz graph.
   * @param  {Object} modules
   * @param  {Array} circular
   * @param  {Object} config
   * @return {Promise}
   */
  static async buildDependenciesGraph(repository, config): Any {
    const graph = graphviz.digraph('G');
    const nodes = {};

    if (config.graphVizPath) {
      graph.setGraphVizPath(config.graphVizPath);
    }

    const depObj: { [id: string]: Version } = {};
    const allComponents: Component[] = await repository.listComponents(false);
    // build all nodes. a node is either a Version object or Component object.
    // each Version node has a parent of Component node. Component node doesn't have a parent.
    await Promise.all(
      allComponents.map(async (component) => {
        // graph.addNode(component.id(), component);
        await Promise.all(
          Object.keys(component.versions).map(async (version) => {
            const componentVersion = await component.loadVersion(version, repository);
            if (!componentVersion) return;
            const nodeId = `${component.id()}${VERSION_DELIMITER}${version}`;
            // nodes[nodeId] = nodes[nodeId] || graph.addNode(nodeId, componentVersion);
            nodes[nodeId] = nodes[nodeId] || graph.addNode(nodeId);
            if (componentVersion.dependencies.isEmpty()) {
              setNodeColor(nodes[nodeId], config.noDependencyColor);
            }
            // graph.setNode(`${component.id()}@${version}`, componentVersion);
            // graph.setParent(`${component.id()}@${version}`, component.id());
            componentVersion.id = component.toBitId();
            depObj[nodeId] = componentVersion;
          })
        );
      })
    );
    // set all edges
    // @todo: currently the label is "require". Change it to be "direct" and "indirect" depends on whether it comes from
    // flattenedDependencies or from dependencies.
    Object.keys(depObj).forEach((id) => {
      // TODO: add dev deps (with different edge color)
      const deps = depObj[id].dependencies.toStringOfIds();
      deps.forEach(dep => graph.addEdge(id, dep));
    });
    return Promise.resolve(graph);
  }

  /**
   * Creates an image from the module dependency graph.
   * @param  {String} imagePath
   * @return {Promise}
   */
  async image(imagePath: string): string {
    // console.log('imagePath', imagePath)
    const options = createGraphvizOptions(this.config);
    options.type = path.extname(imagePath).replace('.', '') || 'png';

    const outputP: Promise = new Promise((resolve, reject) => {
      this.graph.output(options, resolve, (code, out, err) => {
        logger.debug('Error during viz graph output function');
        logger.debug(code, out, err);
        reject(new Error(err));
      });
    });

    const image = await outputP;
    await fs.writeFile(imagePath, image);
    return path.resolve(imagePath);
  }

  /**
   * Return the module dependency graph as DOT output.
   * @return {dot}
   */
  dot() {
    return this.graph.to_dot();
  }
}

/**
 * Set color on a node.
 * @param  {Object} node
 * @param  {String} color
 */
function setNodeColor(node, color) {
  node.set('color', color);
  node.set('fontcolor', color);
}

/**
 * Check if Graphviz is installed on the system.
 * @param  {Object} config
 * @return {Promise}
 */
function checkGraphvizInstalled(graphVizPath) {
  const options = {
    shell: true
  };
  if (graphVizPath) {
    options.cwd = graphVizPath;
  }

  const childProcess = execa('gvpr', ['-V'], options);
  return childProcess.catch((e) => {
    logger.debug(`Graphviz could not be found in path: ${graphVizPath || 'default path'}`);
    throw new Error(`Graphviz could not be found. Ensure that "gvpr" is in your $PATH.\n${e}`);
  });
}

/**
 * Return options to use with graphviz digraph.
 * @param  {Object} config
 * @return {Object}
 */
function createGraphvizOptions(config) {
  const graphVizOptions = config.graphVizOptions || {};

  return {
    G: Object.assign(
      {
        overlap: false,
        pad: 0.111,
        layout: config.layout,
        bgcolor: config.backgroundColor
      },
      graphVizOptions.G
    ),
    E: Object.assign(
      {
        color: config.edgeColor
      },
      graphVizOptions.E
    ),
    N: Object.assign(
      {
        fontname: config.fontName,
        fontsize: config.fontSize,
        color: config.nodeColor,
        fontcolor: config.nodeColor
      },
      graphVizOptions.N
    )
  };
}
