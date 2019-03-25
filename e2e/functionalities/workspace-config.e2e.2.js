import path from 'path';
import chai, { expect } from 'chai';
import Helper from '../e2e-helper';
import { statusFailureMsg } from '../../src/cli/commands/public-cmds/status-cmd';

chai.use(require('chai-fs'));

describe('workspace config', function () {
  this.timeout(0);
  const helper = new Helper();
  after(() => {
    helper.destroyEnv();
  });
  describe('when the, config exists in both bit.json and package.json', () => {
    let localScope;
    before(() => {
      helper.setNewLocalAndRemoteScopes();
      helper.createComponentBarFoo();
      helper.addComponentBarFoo();
      helper.tagAllComponents();
      helper.exportAllComponents();
      helper.reInitLocalScope();
      helper.addRemoteScope();
      helper.initNpm();
      const packageJson = helper.readPackageJson();
      packageJson.bit = {
        env: {},
        componentsDefaultDirectory: 'components/{name}',
        packageManager: 'npm'
      };
      helper.writePackageJson(packageJson);
      localScope = helper.cloneLocalScope();
    });
    describe('when the config conflicts between bit.json and package.json', () => {
      before(() => {
        const bitJson = helper.readBitJson();
        bitJson.componentsDefaultDirectory = 'customBitJson/{name}';
        helper.writeBitJson(bitJson);

        const packageJson = helper.readPackageJson();
        packageJson.bit.componentsDefaultDirectory = 'customPackageJson/{name}';
        helper.writePackageJson(packageJson);
      });
      it('should use the config from bit.json and not from package.json', () => {
        helper.importComponent('bar/foo');
        expect(path.join(helper.localScopePath, 'customBitJson')).to.be.a.directory();
        expect(path.join(helper.localScopePath, 'customPackageJson')).to.not.be.a.path();
      });
    });
    describe('when Bit writes config data', () => {
      before(() => {
        helper.getClonedLocalScope(localScope);
        helper.importComponent('bar/foo -c');
      });
      it('should write the config data to both bit.json and package.json', () => {
        const bitJson = helper.readBitJson();
        expect(bitJson.env).to.have.property('compiler');
        expect(bitJson.env.compiler).to.equal(`${helper.remoteScope}/bar/foo@0.0.1`);

        const packageJson = helper.readPackageJson();
        expect(packageJson.bit.env).to.have.property('compiler');
        expect(packageJson.bit.env.compiler).to.equal(`${helper.remoteScope}/bar/foo@0.0.1`);
      });
    });
  });
  describe('overrides components', () => {
    describe('changing dependencies versions', () => {
      before(() => {
        helper.setNewLocalAndRemoteScopes();
        helper.createFile('', 'foo.js');
        helper.createFile('', 'bar.js', "require('./foo');");
        helper.addComponent('foo.js');
        helper.addComponent('bar.js');
        helper.tagAllComponents();
        helper.tagScope('2.0.0');

        const bitJson = helper.readBitJson();
        bitJson.overrides = {
          bar: {
            dependencies: {
              foo: '0.0.1'
            }
          }
        };
        helper.writeBitJson(bitJson);
      });
      it('bit diff should show the tagged dependency version vs the version from overrides', () => {
        const diff = helper.diff('bar');
        expect(diff).to.have.string('- [ foo@2.0.0 ]');
        expect(diff).to.have.string('+ [ foo@0.0.1 ]');
      });
      describe('tagging the component', () => {
        before(() => {
          helper.tagAllComponents();
        });
        it('should save the overridden dependency version', () => {
          const bar = helper.catComponent('bar@latest');
          expect(bar.dependencies[0].id.version).to.equal('0.0.1');
          expect(bar.flattenedDependencies[0].version).to.equal('0.0.1');
        });
      });
    });
    describe.skip('ignoring dependencies components', () => {
      before(() => {
        helper.setNewLocalAndRemoteScopes();
        helper.createFile('', 'foo1.js');
        helper.createFile('', 'foo2.js');
        helper.createFile('', 'bar.js', "require('./foo1'); require('./foo2'); ");
        helper.addComponent('foo1.js');
        helper.addComponent('foo2.js');
        helper.addComponent('bar.js');
        helper.tagComponent('foo1');

        // as an intermediate step, make sure that tagging 'bar' throws an error because the dependency
        // foo2 was not tagged.
        const tagBar = () => helper.tagComponent('bar');
        expect(tagBar).to.throw();

        const bitJson = helper.readBitJson();
        bitJson.overrides = {
          bar: {
            dependencies: {
              foo2: '-'
            }
          }
        };
        helper.writeBitJson(bitJson);
      });
      describe('tagging the component', () => {
        let output;
        before(() => {
          // output = helper.runWithTryCatch('bit tag bar');
        });
        it('should be able to tag successfully', () => {
          expect(output).to.have.string('1 components tagged');
        });
        it('should remove the dependency and save the overrides data into the model', () => {
          const bar = helper.catComponent('bar@latest');
          expect(bar.dependencies).to.have.lengthOf(1);
          expect(bar).to.have.property('overrides');
          // @todo: assert the overrides data here.
        });
        describe('importing the component', () => {
          before(() => {
            helper.exportAllComponents();
            helper.reInitLocalScope();
            helper.addRemoteScope();
            helper.importComponent('bar');
          });
          it('should write the overrides data into the package.json of the component', () => {});
        });
      });
    });
    describe('ignoring dependencies', () => {
      let scopeAfterAdding;
      before(() => {
        helper.setNewLocalAndRemoteScopes();
        helper.createFile('foo-dir', 'foo1.js');
        helper.createFile('foo-dir', 'foo2.js');
        helper.createFile('bar-dir', 'bar.js', "require('../foo-dir/foo1'); require('../foo-dir/foo2'); ");
        helper.addComponent('foo-dir/foo1.js', { i: 'utils/foo/foo1' });
        helper.addComponent('foo-dir/foo2.js', { i: 'utils/foo/foo2' });
        helper.addComponent('bar-dir/bar.js', { i: 'bar' });
        scopeAfterAdding = helper.cloneLocalScope();
      });
      describe('ignoring the component file altogether', () => {
        let showBar;
        before(() => {
          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'bar-dir/bar.js': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('should not add any dependency to the component', () => {
          expect(showBar.dependencies).to.have.lengthOf(0);
        });
        it('should show the component file as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('bar-dir/bar.js');
        });
      });
      describe('ignoring a dependency file', () => {
        let showBar;
        before(() => {
          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'foo-dir/foo2.js': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('should not add the removed dependency to the component', () => {
          expect(showBar.dependencies).to.have.lengthOf(1);
          expect(showBar.dependencies[0].id).to.not.have.string('foo2');
        });
        it('should show the dependency file as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('foo-dir/foo2.js');
        });
      });
      describe('ignoring a dependencies files with a glob pattern', () => {
        let showBar;
        before(() => {
          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'foo-dir/*': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('should remove all dependencies matching the glob pattern', () => {
          expect(showBar.dependencies).to.have.lengthOf(0);
        });
        it('should show the dependencies files as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('foo-dir/foo2.js');
          expect(showBar.ignoredDependencies.dependencies).to.include('foo-dir/foo1.js');
        });
      });
      describe('ignoring a dependency component', () => {
        let showBar;
        before(() => {
          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'utils/foo/foo1': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('should not add the removed dependency to the component', () => {
          expect(showBar.dependencies).to.have.lengthOf(1);
          expect(showBar.dependencies[0].id).to.not.equal('foo1');
        });
        it('should show the dependency component as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('utils/foo/foo1');
        });
      });
      describe('ignoring a dependencies components by wildcards', () => {
        let showBar;
        before(() => {
          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'utils/foo/*': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('should not add the removed dependencies to the component', () => {
          expect(showBar.dependencies).to.have.lengthOf(0);
        });
        it('should show the dependencies component as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('utils/foo/foo1');
          expect(showBar.ignoredDependencies.dependencies).to.include('utils/foo/foo2');
        });
      });
      describe('ignoring a missing file', () => {
        let showBar;
        before(() => {
          helper.createFile(
            'bar-dir',
            'bar.js',
            "require('../foo-dir/foo1'); require('../foo-dir/foo2'); require('../foo-dir/foo3')"
          );

          // an intermediate step, make sure bit status shows the component with an issue of a missing file
          const status = helper.status();
          expect(status).to.have.string(statusFailureMsg);

          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'foo-dir/foo3*': '-' // we don't enter the entire file foo-dir/foo3.js because the require string doesn't have the extension
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('bit status should not show the component as missing files', () => {
          const status = helper.status();
          expect(status).to.not.have.string(statusFailureMsg);
        });
        it('should show the dependency file as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('foo-dir/foo3');
        });
      });
      describe('ignoring a missing package', () => {
        let showBar;
        before(() => {
          helper.getClonedLocalScope(scopeAfterAdding);
          helper.createFile(
            'bar-dir',
            'bar.js',
            "require('../foo-dir/foo1'); require('../foo-dir/foo2'); require('non-exist-package')"
          );

          // an intermediate step, make sure bit status shows the component with an issue of a missing file
          const status = helper.status();
          expect(status).to.have.string(statusFailureMsg);

          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'non-exist-package': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('bit status should not show the component as missing packages', () => {
          const status = helper.status();
          expect(status).to.not.have.string(statusFailureMsg);
        });
        it('should show the package as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('non-exist-package');
        });
      });
      describe('ignoring a missing component', () => {
        let showBar;
        before(() => {
          helper.getClonedLocalScope(scopeAfterAdding);
          helper.createFile(
            'bar-dir',
            'bar.js',
            "require('../foo-dir/foo1'); require('../foo-dir/foo2'); require('@bit/bit.utils.is-string')"
          );

          // an intermediate step, make sure bit status shows the component with an issue of a missing file
          const status = helper.status();
          expect(status).to.have.string(statusFailureMsg);

          const bitJson = helper.readBitJson();
          bitJson.overrides = {
            bar: {
              dependencies: {
                'bit.utils/*': '-'
              }
            }
          };
          helper.writeBitJson(bitJson);
          showBar = helper.showComponentParsed('bar');
        });
        it('bit status should not show the component as missing component', () => {
          const status = helper.status();
          expect(status).to.not.have.string(statusFailureMsg);
        });
        it('should show the component as ignored', () => {
          expect(showBar).to.have.property('ignoredDependencies');
          expect(showBar.ignoredDependencies).to.have.property('dependencies');
          expect(showBar.ignoredDependencies.dependencies).to.include('bit.utils/is-string');
        });
      });
    });
  });
});
