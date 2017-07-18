'use strict';

var babylon = require('babylon');
var traverse = require('babel-traverse').default;
var fs = require('fs');
var _path = require('path');
var parser = require('vue-template-compiler');
var extension = [];
var projectPath = '';

process.on('message', function (data) {
  try {
    projectPath = data.projectPath;
    extension = data.extension.concat(['js']);
    var rt = parse(data.filepath);
    process.send(rt);
  } catch (e) {
    process.send(null);
  }
});

// return if this path is directory
function isDirectory(filepath) {
  var file = null;
  try {
    file = fs.statSync(filepath);
  } catch (e) {
    return false;
  }
  if (file && file.isDirectory()) {
    return true;
  } else {
    return false;
  }
}

// return if this file exists
function fileExist(filepath) {
  return fs.existsSync(filepath);
}

// return file information
function fileInfo(filepath) {
  var info = null;
  try {
    info = fs.readFileSync(filepath);
    info = info.toString();
    info = JSON.parse(info);
  } catch (e) {
    info = null;
  }
  return info;
}

// try to get relative path
function getRelativepath(filepath) {
  var realPath = null;
  var isDir = isDirectory(filepath);
  if (isDir) {
    filepath += '/index';
  }
  var i = 0;
  for (i = 0; i < extension.length; i++) {
    if (fileExist(filepath + '.' + extension[i])) {
      break;
    }
  }
  if (i < extension.length) {
    realPath = filepath + '.' + extension[i];
  }
  return realPath;
}

// try to get npm path
function getNpmpath(filepath) {
  var info = fileInfo(_path.join(filepath, 'package.json'));
  if (info && info.main) {
    return _path.join(filepath, info.main);
  } else {
    var temppath = _path.join(filepath, 'index.js');
    if (fileExist(temppath)) {
      return temppath;
    } else {
      return null;
    }
  }
}

// parse params by ast
function parseParams(params, content) {
  var result = [];
  try {
    result = params.map(function (param) {
      if (param.type === 'ObjectPattern') {
        return content.split('\n')[param.loc.start.line - 1].slice(param.loc.start.column, param.loc.end.column);
      } else {
        return param.name ? param.name : param.left.name;
      }
    });
  } catch (e) {}
  return result;
}

// parse sub path
function parseSubpath(filepath) {
  var con = fs.readFileSync(filepath);
  con = con.toString();
  if (!con) {
    return;
  }
  var result = babylon.parse(con, {
    sourceType: 'module',
    plugins: '*'
  });
  var obj = { 'export': {}, 'default': null };
  traverse(result, {
    ExportDeclaration: function ExportDeclaration(path) {
      if (path.node.declaration.type === 'FunctionDeclaration') {
        obj['export'][path.node.declaration.id.name] = {
          row: path.node.loc.start.line,
          params: parseParams(path.node.declaration.params, con)
        };
      } else if (path.node.type === 'ExportDefaultDeclaration') {
        obj['default'] = {
          name: path.node.declaration.name,
          row: path.node.loc.start.line
        };
      }
    }
  });
  return obj;
}

// parse file
function parse(file) {
  var content = fs.readFileSync(file);
  content = content.toString();
  var obj = parser.parseComponent(content);
  var scriptContent = "\n".repeat(content.slice(0, obj.script.start).split('\n').length - 1) + obj.script.content;

  var result = babylon.parse(scriptContent, {
    sourceType: 'module',
    plugins: '*'
  });
  var mapResult = {
    funcs: {},
    defaultSpecifier: {},
    context: {},
    component: {
      methods: {},
      variables: []
    }
  };
  traverse(result, {
    ImportDeclaration: function ImportDeclaration(path) {
      var node = path.node;
      if (!(node.specifiers && node.specifiers.length)) {
        return;
      }
      // specifiers
      var defaultSpecifier = null;
      var specifiers = [];
      var nodes = node.specifiers;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].type === 'ImportDefaultSpecifier') {
          defaultSpecifier = nodes[i].local.name;
        } else if (nodes[i].type === 'ImportSpecifier') {
          specifiers.push(nodes[i].local.name);
        }
      }
      // source
      var source = node.source.value;
      var realPath = _path.join(_path.dirname(file), source);
      var isNpmPath = false;
      // if source is not relative path,then return
      if (source[0] !== '.') {
        isNpmPath = true;
        realPath = getNpmpath(_path.join(projectPath, 'node_modules', source));
      } else {
        realPath = getRelativepath(realPath) || realPath;
      }
      // if realPath exists
      if (realPath) {
        if (defaultSpecifier) {
          if (isNpmPath) {
            // here means npm package
            /*
            * assign default specifier with `realpath`
            * so that we can use require to get it's properties in nw env
            */
            mapResult.context[defaultSpecifier] = realPath;
          } else {
            mapResult.defaultSpecifier[defaultSpecifier] = {
              path: realPath
            };
          }
        }
        if (specifiers.length) {
          // check file which is a relative path and file type is '.js'
          var exportInfo = null;
          if (!isNpmPath && /\.js/.test(realPath)) {
            exportInfo = parseSubpath(realPath);
          }
          if (exportInfo) {
            specifiers.forEach(function (item) {
              if (exportInfo.export[item]) {
                mapResult.funcs[item] = {
                  path: realPath,
                  row: exportInfo.export[item].row,
                  params: exportInfo.export[item].params
                };
              }
            });
          }
        }
      }
    },
    ExportDefaultDeclaration: function ExportDefaultDeclaration(path) {
      path.traverse({
        ObjectProperty: function ObjectProperty(subpath) {
          if (subpath.parentPath.parentPath.type !== 'ExportDefaultDeclaration') {
            return;
          }
          // methods
          if (subpath.node.key.name === 'methods') {
            subpath.node.value.properties.forEach(function (property) {
              var name = property.key.name;
              var params = property.params.map(function (param) {
                return param.name ? param.name : param.left.name;
              });
              mapResult.component.methods[name] = {
                path: file,
                row: property.loc.start.line,
                params: params
              };
            });
          } else if (subpath.node.key.name === 'computed') {
            var properties = subpath.node.value.properties;
            properties.forEach(function (property) {
              if (property.key && property.key.name) {
                mapResult.component.variables.push(property.key.name);
              } else {
                subpath.traverse({
                  SpreadProperty: function SpreadProperty(_path) {
                    _path.traverse({
                      ObjectExpression: function ObjectExpression(__path) {
                        __path.node.properties.forEach(function (property) {
                          if (property.key.name) {
                            mapResult.component.variables.push(property.key.name);
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        },
        ObjectMethod: function ObjectMethod(subpath) {
          if (subpath.parentPath.parentPath.type !== 'ExportDefaultDeclaration') {
            return;
          }
          // data
          if (subpath.node.key.name === 'data' && subpath.node.kind === 'method') {
            subpath.traverse({
              ReturnStatement: function ReturnStatement(path) {
                path.node.argument.properties.forEach(function (property) {
                  mapResult.component.variables.push(property.key.name);
                });
              }
            });
          }
        }
      });
    },
    FunctionDeclaration: function FunctionDeclaration(path) {
      var node = path.node;
      var name = node.id.name;
      var params = parseParams(node.params, scriptContent);
      var value = {
        path: file,
        row: node.id.loc.start.line,
        params: params
      };
      mapResult.funcs[name] = value;
    }
  });
  return mapResult;
}