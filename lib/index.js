'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _vue = require('./prompt/vue');

var _vue2 = _interopRequireDefault(_vue);

var _videPluginContextJs = require('vide-plugin-context-js');

var _videPluginContextJs2 = _interopRequireDefault(_videPluginContextJs);

var _videPluginContextCss = require('vide-plugin-context-css');

var _videPluginContextCss2 = _interopRequireDefault(_videPluginContextCss);

var _videPluginContextHtml = require('vide-plugin-context-html');

var _videPluginContextHtml2 = _interopRequireDefault(_videPluginContextHtml);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// const logger = require('simple-file-logger')
// const _log = logger({
//   path: './',   
//   filename: 'log'
// })
// const log = function (str) { if (typeof str === 'object') str = JSON.stringify(str); _log(str, null)}

var contexts = {};
var integratedWords = []; //it's integrated defintegrate
var integratedMatch = {};

var words = []; //this is created by each vue file
var wordsMatch = {};
var currentContext = {}; //context of current vue file
var prevPromptStr = '';
var prevPromptLists = [];
var vueMapResult = null; // vue map result
var vueInstanceContext = ['$options', '$parent', '$root', '$children', '$refs', '$vnode', '$slots', '$scopedSlots', '$createElement', '$store', '$el', '$set', '$delete', '$watch', '$on', '$once', '$off', '$emit', '$forceUpdate', '$destroy', '$nextTick', '$mount'];
// process instance
var process = null;

function loadIntegratedWords() {
  var allWords = [];
  var context = void 0;
  var i = void 0;
  // add context
  allWords = _videPluginContextHtml2.default.variables;
  context = _videPluginContextCss2.default.context;
  for (i in context) {
    contexts[i] = context[i];
    allWords.push(i);
    allWords = allWords.concat(context[i]);
  }
  context = _videPluginContextJs2.default.context;
  for (i in context) {
    contexts[i] = context[i];
    allWords.push(i);
    allWords = allWords.concat(context[i]);
  }
  allWords = allWords.concat(_videPluginContextJs2.default.variables);

  context = _vue2.default.context;
  for (i in context) {
    contexts[i] = context[i];
    allWords.push(i);
    allWords = allWords.concat(context[i]);
  }
  allWords = allWords.concat(_vue2.default.variables);
  if (nw.App.manifest.version > '1.0.1') {
    allWords = allWords.concat(_vue2.default.blocks);
  }
  // add variables
  var key = void 0;
  for (i = 0; i < allWords.length; i++) {
    key = allWords[i].value || allWords[i];
    if (!integratedMatch[key]) {
      integratedWords.push(allWords[i]);
      integratedMatch[key] = 1;
    }
  }
}

function analyseContent(con) {
  var reg = /([a-zA-Z_\$][a-zA-Z0-9_\$]{3,})/g;
  var arr = con.match(reg);
  if (!arr) {
    return;
  }
  arr.forEach(function (item) {
    if (!wordsMatch[item] && !integratedMatch[item]) {
      words.push(item);
      wordsMatch[item] = 1;
    }
  });
}

function getTypedCharacters(action, store, editor) {
  if (action.action == 'remove' && !store.state.editor.promptLists.length) {
    return '';
  }
  if (action && action.lines.length === 1 && /^\S+$/.test(action.lines[0]) && action.start.row != undefined && action.start.row == action.end.row) {
    var session = editor.session;
    var line = session.getLine(action.start.row);
    var str = void 0;
    var after_adding_letter = "";

    if (action.action == 'insert' && action.lines[0].length == 1) {
      str = line.slice(0, action.end.column);
      after_adding_letter = line.slice(action.end.column, action.end.column + 1);
    } else if (action.action == 'remove' && action.lines[0].length == 1) {
      str = line.slice(0, action.start.column);
      after_adding_letter = line.slice(action.start.column, action.start.column + 1);
    } else {
      return '';
    }

    // if after adding letter,there is a legal letter,it means we are editing in a word,
    if (after_adding_letter && /[a-zA-Z0-9_$]+$/.test(after_adding_letter)) {
      return '';
    }

    var value = str.match(/[a-zA-Z_\$][a-zA-Z0-9_$\.\-\:]*$/);
    if (value && value[0]) {
      value = value[0];
      var splitChar = value.includes(':') ? ':' : '.';
      var arr = value.split(splitChar);
      if (arr.length === 2) {
        if (contexts[arr[0]] || currentContext[arr[0]]) {
          value = {
            context: arr[0],
            value: arr[1]
          };
        } else {
          value = arr[1];
        }
      } else {
        value = arr.pop();
      }
    }
    return value ? value : '';
  } else {
    return '';
  }
}

function matchWords(str) {
  str = str.replace('$', '\\$');
  var reg = new RegExp('^' + str, 'i');
  var lists = integratedWords.concat(words);
  if (prevPromptStr && str.slice(0, prevPromptStr.length) === prevPromptStr) {
    lists = prevPromptLists;
  }
  var results = [];
  results = lists.filter(function (item) {
    if (item.value) {
      return reg.test(item.value);
    } else {
      return reg.test(item);
    }
  });
  if (!results.length) {
    reg = new RegExp(str, 'i');
    results = lists.filter(function (item) {
      if (item.value) {
        return reg.test(item.value);
      } else {
        return reg.test(item);
      }
    });
  }
  results.sort(function (a, b) {
    a = a.value || a;
    b = b.value || b;
    return a > b ? 1 : -1;
  });
  return results;
}

function matchContext(item) {
  var lists = contexts[item.context] ? contexts[item.context] : currentContext[item.context];
  if (item.value) {
    var str = item.value;
    lists = lists.filter(function (item) {
      var v = item.name || item.value || item;
      return v.includes(str);
    });
  }
  return lists;
}

function _receive(data) {
  if (data) {
    vueMapResult = data;
    var value = void 0;
    var name = void 0;
    for (var i in data.funcs) {
      name = i + '(' + data.funcs[i].params.join(',') + ')';
      value = i + '()';
      if (!wordsMatch[name]) {
        words.push({ value: value, name: name, params: data.funcs[i].params });
        wordsMatch[name] = 1;
      }
    }
    var methods = [];
    for (var _i in data.component.methods) {
      name = _i + '(' + data.component.methods[_i].params.join(',') + ')';
      value = _i + '()';
      methods.push({ value: value, name: name, params: data.component.methods[_i].params });
    }
    // deal with context
    currentContext = {};
    for (var _i2 in data.context) {
      var realPath = data.context[_i2];
      var obj = void 0;
      try {
        obj = require(realPath);
      } catch (e) {
        continue;
      }
      var properties = [];
      if (Object.keys(obj).join('') === 'default') {
        obj = obj.default;
      }
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          properties.push(key);
        }
      }
      currentContext[_i2] = properties.sort();
    }
    currentContext['this'] = data.component.variables.concat(methods).concat(vueInstanceContext).sort();
  } else {
    vueMapResult = null;
    currentContext = {};
  }
  if (process) {
    process.kill();
    process = null;
  }
}

function analyseVue(filepath, pkg, projectPath) {
  var extension = pkg.vide && pkg.vide.promptExtension || [];
  if (process) {
    process.kill();
  }
  process = require('child_process').fork(_path2.default.join(__dirname, 'traverse.js'));
  process.send({ filepath: filepath, extension: extension, projectPath: projectPath });
  process.on('message', _receive);
}

exports.default = function (_ref) {
  var editor = _ref.editor,
      store = _ref.store,
      view = _ref.view,
      packageInfo = _ref.packageInfo,
      baseClass = _ref.baseClass,
      signal = _ref.signal,
      console = _ref.console;

  global.console = console;
  // load integrated words
  loadIntegratedWords();
  // subscribe change file
  store.subscribe(function (mutation, state) {
    if (store.state.editor.promptName === 'videPluginPromptVue') {
      if (['EDITOR_SET_FILE_TYPE', 'FILE_CREATE'].includes(mutation.type)) {
        analyseVue(store.state.editor.currentFile, packageInfo.package, store.state.projectPath);
        analyseContent(store.state.editor.content);
      }
    }
  });

  editor.session.on('change', function (action) {
    if (store.state.editor.promptName === 'videPluginPromptVue' && ["insert", "remove"].includes(action.action) && action.lines.join('') === '') {
      analyseVue(store.state.editor.currentFile, packageInfo.package, store.state.projectPath);
      analyseContent(editor.getValue());
    }
  });

  signal.receive('saveFile', function () {
    if (store.state.editor.promptName === 'videPluginPromptVue') {
      words = [];
      wordsMatch = {};
      analyseVue(store.state.editor.currentFile, packageInfo.package, store.state.projectPath);
      analyseContent(store.state.editor.content);
    }
  });
  // return execute class
  return function () {
    function videPluginPromptVue() {
      _classCallCheck(this, videPluginPromptVue);
    }

    _createClass(videPluginPromptVue, [{
      key: 'index',
      value: function index(_ref2) {
        var action = _ref2.action;

        var promptLists = [];
        var promptStr = '';
        try {
          promptStr = getTypedCharacters(action, store, editor);
          if (promptStr && (typeof promptStr === 'undefined' ? 'undefined' : _typeof(promptStr)) === 'object') {
            promptLists = matchContext(promptStr);
            promptStr = promptStr.value;
          } else if (promptStr) {
            promptLists = matchWords(promptStr);
          }
        } catch (e) {}
        if (promptLists.length) {
          prevPromptStr = promptStr;
          prevPromptLists = promptLists;
          store.dispatch('editor/setPromptLists', { promptStr: promptStr, promptLists: promptLists });
        } else {
          prevPromptStr = '';
          prevPromptLists = [];
          store.dispatch('editor/cleanPromptLists');
        }
      }
    }, {
      key: 'mappingArea',
      value: function mappingArea(position) {
        var result = require('vue-template-compiler').parseComponent(editor.getValue());
        var len = void 0;
        if (position.row === 0) {
          len = position.column;
        } else {
          len = editor.session.getLines(0, position.row - 1).join('') + editor.session.getLine(position.row).slice(0, position.column);
          len = len.length;
        }
        var type = null;
        if (result.template.start <= len && len <= result.template.end) {
          type = 'template';
        } else if (result.script.start <= len && len <= result.script.end) {
          type = 'script';
        }
        return type;
      }

      /*
      * mapping word according to position
      */

    }, {
      key: '_mappingWord',
      value: function _mappingWord(line, position, endReg, startReg, callback) {
        var prevFlagment = line.slice(0, position.column);
        var matches = prevFlagment.match(endReg);
        var result = null;
        if (matches) {
          result = line.slice(matches.index).match(startReg);
          if (result && callback) {
            result = callback(result);
          }
        }
        return result;
      }

      // mapping vue component

    }, {
      key: '_mappingComponent',
      value: function _mappingComponent(component) {
        var result = null;
        if (vueMapResult.defaultSpecifier && vueMapResult.defaultSpecifier[component]) {
          result = vueMapResult.defaultSpecifier[component];
          result['value'] = component;
        } else {
          var _component = component.replace(/-/g, '').toLowerCase();
          for (var key in vueMapResult.defaultSpecifier) {
            if (key.toLowerCase() === _component) {
              result = vueMapResult.defaultSpecifier[key];
              result['value'] = component;
              break;
            }
          }
        }
        return result;
      }

      // mapping template tag

    }, {
      key: 'mappingTemplate',
      value: function mappingTemplate(position) {
        var line = editor.session.getLine(position.row);
        var matches = void 0;
        // map result
        var result = null;
        result = this._mappingWord(line, position, /<[\w\-\$]+$/, /^<([\w\-\$]+)/, function (result) {
          return result[1];
        });
        // match vue component
        if (result) {
          result = this._mappingComponent(result);
        } else {
          var prevFlagment = line.slice(0, position.column);
          matches = prevFlagment.match(/(v-on:|@)\S+?\s*=\s*"\s*\S+$/);
          if (matches) {
            var event = this._mappingWord(line, position, /[\w\-\$]+$/, /^[\w\-\$]+/, function (result) {
              return result[0];
            });
            if (event && vueMapResult.component.methods[event]) {
              result = vueMapResult.component.methods[event];
              result['value'] = event[0];
            }
          }
        }
        return result;
      }

      // mapping script tag

    }, {
      key: 'mappingScript',
      value: function mappingScript(position) {
        var line = editor.session.getLine(position.row);
        // map result
        var result = null;
        var matchValue = void 0;
        matchValue = this._mappingWord(line, position, /[\w\-\$]+$/, /^([\w\-\$]+)\(/, function (result) {
          return result[1];
        });
        // mapping of call function
        if (matchValue) {
          result = vueMapResult.component.methods[matchValue] || vueMapResult.funcs[matchValue] || null;
          if (result) {
            result['value'] = matchValue;
          }
        } else if (/^\s*import/.test(line)) {
          // import mapping
          matchValue = this._mappingWord(line, position, /[\w\-\$]+$/, /^[\w\-\$]+/, function (result) {
            return result[0];
          });
          if (matchValue) {
            result = this._mappingComponent(matchValue);
          }
        }
        return result;
      }
    }, {
      key: 'mapping',
      value: function mapping(_ref3) {
        var position = _ref3.position;

        var areaType = this.mappingArea(position);
        if (areaType === 'template') {
          return this.mappingTemplate(position);
        } else if (areaType === 'script') {
          return this.mappingScript(position);
        }
      }
    }]);

    return videPluginPromptVue;
  }();
};