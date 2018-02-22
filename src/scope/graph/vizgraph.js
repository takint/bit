/** @flow */
import path from 'path';
import fs from 'fs-extra';
import execa from 'execa';
import graphviz from 'graphviz';
import GraphLib from 'graphlib';
import logger from '../../logger/logger';

const Graph = GraphLib.Graph;
const Digraph = graphviz.digraph;

type ConfigProps = {
  layout?: string, // dot Layout to use in the graph
  fontName?: string, // Arial font name to use in the graph
  fontSize?: string, // 14px Font size to use in the graph
  backgroundColor?: string, // #000000 Background color for the graph
  nodeColor?: string, // #c6c5fe Default node color to use in the graph
  noDependencyColor?: string, // #cfffac Color to use for nodes with no dependencies
  edgeColor?: string, // #757575 Edge color to use in the graph
  graphVizOptions?: Object, // null Custom GraphViz options
  graphVizPath?: string // null Custom GraphViz path
};

const defaultConfig: ConfigProps = {
  layout: 'dot',
  fontName: 'Arial',
  fontSize: '14px',
  backgroundColor: '#000000',
  nodeColor: '#c6c5fe',
  noDependencyColor: '#cfffac',
  devDependencyColor: '#ff0000',
  edgeColor: '#757575'
};

export default class VisualDependencyGraph {
  graphlib: Graph;
  graph: Digraph;
  config: ConfigProps;
  rawOptions: Object;

  constructor(graphlib: Graph, graph: Digraph, config: ConfigProps, rawOptions: Object) {
    this.graph = graph;
    this.graphlib = graphlib;
    this.config = config;
    this.rawOptions = rawOptions;
  }

  static async loadFromGraphlib(graphlib: Graph, config: ConfigProps = {}, rawOptions: Object = {}) {
    const concreteConfig = Object.assign({}, defaultConfig, config);
    checkGraphvizInstalled(config.graphVizPath);
    const graph: Digraph = VisualDependencyGraph.buildDependenciesGraph(graphlib, concreteConfig);
    return new VisualDependencyGraph(graphlib, graph, concreteConfig, rawOptions);
  }

  /**
   * Creates the graphviz graph.
   * @param  {Object} modules
   * @param  {Array} circular
   * @param  {Object} config
   * @return {Promise}
   */
  static buildDependenciesGraph(graphlib, config): Digraph {
    const graph = graphviz.digraph('G');

    if (config.graphVizPath) {
      graph.setGraphVizPath(config.graphVizPath);
    }

    const nodes = graphlib.nodes();
    const edges = graphlib.edges();

    nodes.forEach((node) => {
      // Only apply on lower level of nodes
      if (graphlib.children(node).length === 0) {
        const vizNode = graph.addNode(node);
        if (graphlib.outEdges(node).length === 0) {
          setNodeColor(vizNode, config.noDependencyColor);
        }
      }
    });
    edges.forEach((edge) => {
      const edgeType = graphlib.edge(edge);
      const vizEdge = graph.addEdge(edge.v, edge.w);
      if (edgeType === 'dev') {
        setEdgeColor(vizEdge, config.devDependencyColor);
      }
    });

    return graph;
  }

  /**
   * Creates an image from the module dependency graph.
   * @param  {String} imagePath
   * @return {Promise}
   */
  async image(imagePath: string): Promise<string> {
    // console.log('imagePath', imagePath)
    const options: Object = createGraphvizOptions(this.config);
    const type: string = path.extname(imagePath).replace('.', '') || 'png';
    options.type = type;

    const outputP: Promise<Buffer> = new Promise((resolve, reject) => {
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
 * Set color on an edge.
 * @param  {Object} edge
 * @param  {String} color
 */
function setEdgeColor(edge, color) {
  edge.set('color', color);
}

/**
 * Check if Graphviz is installed on the system.
 * @param  {Object} config
 * @return {Promise}
 */
function checkGraphvizInstalled(graphVizPath?: string) {
  const options: Object = {
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
