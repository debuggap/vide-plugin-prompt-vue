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
//   path: './logs',   
//   filename: 'log'
// })
// const log = function (str) { _log(str, null)}

var contexts = {};
var integratedWords = []; //it's integrated defintegrate
var integratedMatch = {};
var words = []; //this is created by each vue file
var prevPromptStr = '';
var prevPromptLists = [];

function loadIntegratedWords() {
  var i = void 0;
  var allWords = [];
  var context = void 0;
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
  // add variables
  for (i = 0; i < allWords.length; i++) {
    if (!integratedMatch[allWords[i]]) {
      integratedWords.push(allWords[i]);
      integratedMatch[allWords[i]] = 1;
    }
  }
}

function analyseContent(con) {
  var reg = /([a-zA-Z_\$][a-zA-Z0-9_\$]{3,})/g;
  var arr = con.match(reg);
  words = [];
  if (!arr) {
    return;
  }
  var matchObj = {};
  arr.forEach(function (item) {
    if (!matchObj[item] && !integratedMatch[item]) {
      words.push(item);
      matchObj[item] = 1;
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
        if (contexts[arr[0]]) {
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
    return reg.test(item);
  });
  if (!results.length) {
    reg = new RegExp(str, 'i');
    results = lists.filter(function (item) {
      return reg.test(item);
    });
  }
  results.sort(function (a, b) {
    return a.value > b.value ? 1 : -1;
  });
  return results;
}

function matchContext(item) {
  var lists = contexts[item.context];
  if (item.value) {
    var str = item.value;
    lists = lists.filter(function (item) {
      return item.includes(str);
    });
  }
  return lists;
}

exports.default = function (_ref) {
  var editor = _ref.editor,
      store = _ref.store,
      view = _ref.view,
      packageInfo = _ref.packageInfo,
      baseClass = _ref.baseClass;

  // load integrated words
  loadIntegratedWords();
  // subscribe change file
  store.subscribe(function (mutation, state) {
    if (['EDITOR_SET_FILE_TYPE', 'FILE_CREATE'].includes(mutation.type) && store.state.editor.promptName === 'videPluginPromptVue') {
      analyseContent(state.editor.content);
    }
  });
  editor.session.on('change', function (action) {
    if (store.state.editor.promptName === 'videPluginPromptVue' && action.action === 'insert' && action.lines.join('') === '') {
      analyseContent(editor.getValue());
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
    }]);

    return videPluginPromptVue;
  }();
};