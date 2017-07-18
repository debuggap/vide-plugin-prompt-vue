import path from 'path'
import vuePrompt from './prompt/vue'
import jsPrompt from 'vide-plugin-context-js'
import cssPrompt from 'vide-plugin-context-css'
import htmlPrompt from 'vide-plugin-context-html'
// const logger = require('simple-file-logger')
// const _log = logger({
//   path: './',   
//   filename: 'log'
// })
// const log = function (str) { if (typeof str === 'object') str = JSON.stringify(str); _log(str, null)}

let contexts = {}
let integratedWords = [] //it's integrated defintegrate
let integratedMatch = {}

let words = [] //this is created by each vue file
let wordsMatch = {}
let currentContext = {} //context of current vue file
let prevPromptStr = ''
let prevPromptLists = []
let vueMapResult = null // vue map result
let vueInstanceContext = ['$options', '$parent', '$root', '$children', '$refs', '$vnode', '$slots', '$scopedSlots', '$createElement', '$store', '$el', '$set', '$delete', '$watch', '$on', '$once', '$off', '$emit', '$forceUpdate', '$destroy', '$nextTick', '$mount']
// process instance
let process = null

function loadIntegratedWords () {
  let allWords = []
  let context
  let i
  // add context
  allWords = htmlPrompt.variables
  context = cssPrompt.context
  for (i in context) {
    contexts[i] = context[i]
    allWords.push(i)
    allWords = allWords.concat(context[i])
  }
  context = jsPrompt.context
  for (i in context) {
    contexts[i] = context[i]
    allWords.push(i)
    allWords = allWords.concat(context[i])
  }
  allWords = allWords.concat(jsPrompt.variables)
  
  context = vuePrompt.context
  for (i in context) {
    contexts[i] = context[i]
    allWords.push(i)
    allWords = allWords.concat(context[i])
  }
  allWords = allWords.concat(vuePrompt.variables)
  if (nw.App.manifest.version > '1.0.1') {
    allWords = allWords.concat(vuePrompt.blocks)
  }
  // add variables
  let key
  for (i = 0; i < allWords.length; i++) {
    key = allWords[i].value || allWords[i]
    if (!integratedMatch[key]) {
      integratedWords.push(allWords[i])
      integratedMatch[key] = 1
    }
  }
}

function analyseContent (con) {
  let reg = /([a-zA-Z_\$][a-zA-Z0-9_\$]{3,})/g
  let arr = con.match(reg)
  if (!arr) {
    return
  }
  arr.forEach((item) => {
    if (!wordsMatch[item] && !integratedMatch[item]) {
      words.push(item)
      wordsMatch[item] = 1
    }
  })
}

function getTypedCharacters (action, store, editor) {
  if (action.action == 'remove' && !store.state.editor.promptLists.length) {
    return ''
  }
  if (action && action.lines.length === 1 && /^\S+$/.test(action.lines[0]) && action.start.row != undefined && action.start.row == action.end.row) {
    let session = editor.session
    let line = session.getLine(action.start.row)
    let str
    let after_adding_letter = ""
    
    if (action.action == 'insert' && action.lines[0].length == 1) {
      str = line.slice(0, action.end.column)
      after_adding_letter = line.slice(action.end.column, action.end.column + 1)
    } else if (action.action == 'remove' && action.lines[0].length == 1) {
      str = line.slice(0, action.start.column)
      after_adding_letter = line.slice(action.start.column, action.start.column + 1)
    } else {
      return ''
    }
    
    // if after adding letter,there is a legal letter,it means we are editing in a word,
    if (after_adding_letter && /[a-zA-Z0-9_$]+$/.test(after_adding_letter)) {
      return ''
    }
    
    let value = str.match(/[a-zA-Z_\$][a-zA-Z0-9_$\.\-\:]*$/)
    if (value && value[0]) {
      value = value[0]
      let splitChar = value.includes(':') ? ':' : '.'
      let arr = value.split(splitChar)
      if (arr.length === 2) {
        if (contexts[arr[0]] || currentContext[arr[0]]) {
          value = {
            context: arr[0],
            value: arr[1]
          }
        } else {
          value = arr[1]
        }
      } else {
        value = arr.pop()
      }
    }
    return value ? value : '';
  } else {
    return ''
  } 
}

function matchWords (str) {
  str = str.replace('$','\\$')
  let reg = new RegExp('^' + str, 'i')
  let lists = integratedWords.concat(words)
  if (prevPromptStr && str.slice(0, prevPromptStr.length) === prevPromptStr) {
      lists = prevPromptLists
  }
  let results = []
  results = lists.filter((item) => {
    if (item.value) {
      return reg.test(item.value) 
    } else {
      return reg.test(item)
    }
  })
  if (!results.length) {
    reg = new RegExp(str, 'i')
    results = lists.filter((item) => {
      if (item.value) {
        return reg.test(item.value) 
      } else {
        return reg.test(item)
      }
    })
  }
  results.sort(function (a,b){
    a = a.value || a
    b = b.value || b
    return a > b? 1 : -1;
  })
  return results
}

function matchContext (item) {
  let lists = contexts[item.context] ? contexts[item.context] : currentContext[item.context]
  if (item.value) {
    let str = item.value
    lists = lists.filter((item) => {
      let v = item.name || item.value || item
      return v.includes(str)
    })
  }
  return lists
}

function _receive (data) {
  if (data) {
    vueMapResult = data
    let value
    let name
    for (let i in data.funcs) {
      name = i + '(' + data.funcs[i].params.join(',') + ')'
      value = i + '()'
      if (!wordsMatch[name]) {
        words.push({value, name, params: data.funcs[i].params})
        wordsMatch[name] = 1
      }
    }
    let methods = []
    for (let i in data.component.methods) {
      name = i + '(' + data.component.methods[i].params.join(',') + ')'
      value = i + '()'
      methods.push({value, name, params: data.component.methods[i].params})
    }
    // deal with context
    currentContext = {}
    for (let i in data.context) {
      let realPath = data.context[i]
      let obj
      try {
        obj = require(realPath)
      } catch (e) {
        continue
      }
      let properties = []
      if (Object.keys(obj).join('') === 'default') {
        obj = obj.default
      }
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          properties.push(key)
        }
      }
      currentContext[i] = properties.sort()
    }
    currentContext['this'] = data.component.variables.concat(methods).concat(vueInstanceContext).sort()
  } else {
    vueMapResult = null
    currentContext = {}
  }
  if (process) {
    process.kill()
    process = null
  }
}

function analyseVue (filepath, pkg, projectPath) {
  let extension = pkg.vide && pkg.vide.promptExtension || []
  if (process) {
    process.kill()
  }
  process = require('child_process').fork(path.join(__dirname, 'traverse.js'))
  process.send({filepath, extension, projectPath})
  process.on('message', _receive)
}

export default ({editor, store, view, packageInfo, baseClass, signal, console}) => {
  global.console = console
  // load integrated words
  loadIntegratedWords()
  // subscribe change file
  store.subscribe((mutation, state) => {
    if (store.state.editor.promptName === 'videPluginPromptVue') {
      if (['EDITOR_SET_FILE_TYPE','FILE_CREATE'].includes(mutation.type)) {
        analyseVue(store.state.editor.currentFile, packageInfo.package, store.state.projectPath)
        analyseContent(store.state.editor.content)
      }
    }
  })

  editor.session.on('change', function (action) {
    if (store.state.editor.promptName === 'videPluginPromptVue' && ["insert", "remove"].includes(action.action) && action.lines.join('') === '') {
      analyseVue(store.state.editor.currentFile, packageInfo.package, store.state.projectPath)
      analyseContent(editor.getValue())
    }
  })
  
  signal.receive('saveFile', () => {
    if (store.state.editor.promptName === 'videPluginPromptVue') {
      words = []
      wordsMatch = {}
      analyseVue(store.state.editor.currentFile, packageInfo.package, store.state.projectPath)
      analyseContent(store.state.editor.content)
    }
  })
  // return execute class
  return class videPluginPromptVue {
    index ({action}) {
      let promptLists = []
      let promptStr = ''
      try {
        promptStr = getTypedCharacters(action, store, editor)
        if (promptStr && typeof promptStr === 'object') {
          promptLists = matchContext(promptStr)
          promptStr = promptStr.value
        } else if (promptStr) {
          promptLists = matchWords(promptStr)
        }
      } catch (e) {}
      if (promptLists.length) {
        prevPromptStr = promptStr
        prevPromptLists = promptLists
        store.dispatch('editor/setPromptLists', {promptStr, promptLists})
      } else {
        prevPromptStr = ''
        prevPromptLists = []
        store.dispatch('editor/cleanPromptLists')
      }
    }
    
    mappingArea (position) {
      let result = require('vue-template-compiler').parseComponent(editor.getValue())
      let len
      if (position.row === 0) {
        len = position.column
      } else {
        len = editor.session.getLines(0, position.row - 1).join('') + editor.session.getLine(position.row).slice(0, position.column)
        len = len.length
      }
      let type = null
      if (result.template.start <=len && len <= result.template.end) {
        type = 'template'
      } else if (result.script.start <=len && len <= result.script.end) {
        type = 'script'
      }
      return type
    }
    
    /*
    * mapping word according to position
    */
    _mappingWord (line, position, endReg, startReg, callback) {
      let prevFlagment = line.slice(0, position.column)
      let matches = prevFlagment.match(endReg)
      let result = null
      if (matches) {
        result = line.slice(matches.index).match(startReg)
        if (result && callback) {
          result = callback(result)
        }
      }
      return result
    }
    
    // mapping vue component
    _mappingComponent (component) {
      let result = null
      if (vueMapResult.defaultSpecifier && vueMapResult.defaultSpecifier[component]) {
        result = vueMapResult.defaultSpecifier[component]
        result['value'] = component
      } else {
        let _component = component.replace(/-/g, '').toLowerCase()
        for (let key in vueMapResult.defaultSpecifier) {
          if (key.toLowerCase() === _component) {
            result = vueMapResult.defaultSpecifier[key]
            result['value'] = component
            break
          }
        }
      }
      return result
    }
    
    // mapping template tag
    mappingTemplate (position) {
      let line = editor.session.getLine(position.row)
      let matches
      // map result
      let result = null
      result = this._mappingWord(line, position, /<[\w\-\$]+$/, /^<([\w\-\$]+)/, (result) => result[1])
      // match vue component
      if (result) {
        result = this._mappingComponent(result)
      } else {
        let prevFlagment = line.slice(0, position.column)
        matches = prevFlagment.match(/(v-on:|@)\S+?\s*=\s*"\s*\S+$/)
        if (matches) {
          let event = this._mappingWord(line, position, /[\w\-\$]+$/, /^[\w\-\$]+/, (result) => result[0])
          if (event && vueMapResult.component.methods[event]) {
            result = vueMapResult.component.methods[event]
            result['value'] = event[0]
          }
        }
      }
      return result
    }
    
    // mapping script tag
    mappingScript (position) {
      let line = editor.session.getLine(position.row)
      // map result
      let result = null
      let matchValue
      matchValue = this._mappingWord(line, position, /[\w\-\$]+$/, /^([\w\-\$]+)\(/, (result) => result[1])
      // mapping of call function
      if (matchValue) {
        result = vueMapResult.component.methods[matchValue] || vueMapResult.funcs[matchValue] || null
        if (result) {
          result['value'] = matchValue
        }
      } else if (/^\s*import/.test(line)) {
        // import mapping
        matchValue = this._mappingWord(line, position, /[\w\-\$]+$/, /^[\w\-\$]+/, (result) => result[0])
        if (matchValue) {
          result = this._mappingComponent(matchValue)
        }
      }
      return result
    }
    
    mapping ({position}) {
      let areaType = this.mappingArea(position)
      if (areaType === 'template') {
        return this.mappingTemplate(position)
      } else if (areaType === 'script') {
        return this.mappingScript(position)
      }
    }
  }
}
