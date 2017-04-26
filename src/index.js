import path from 'path'
import vuePrompt from './prompt/vue'
import jsPrompt from 'vide-plugin-context-js'
import cssPrompt from 'vide-plugin-context-css'
import htmlPrompt from 'vide-plugin-context-html'
// const logger = require('simple-file-logger')
// const _log = logger({
//   path: './logs',   
//   filename: 'log'
// })
// const log = function (str) { _log(str, null)}

let contexts = {}
let integratedWords = [] //it's integrated defintegrate
let integratedMatch = {}
let words = [] //this is created by each vue file
let prevPromptStr = ''
let prevPromptLists = []

function loadIntegratedWords () {
  let i
  let allWords = []
  let context
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
  // add variables
  for (i = 0; i < allWords.length; i++) {
    if (!integratedMatch[allWords[i]]) {
      integratedWords.push(allWords[i])
      integratedMatch[allWords[i]] = 1
    }
  }
}

function analyseContent (con) {
  let reg = /([a-zA-Z_\$][a-zA-Z0-9_\$]{3,})/g
  let arr = con.match(reg)
  words =[]
  if (!arr) {
    return
  }
  let matchObj = {}
  arr.forEach((item) => {
    if (!matchObj[item] && !integratedMatch[item]) {
      words.push(item)
      matchObj[item] = 1
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
        if (contexts[arr[0]]) {
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
    return reg.test(item)
  })
  if (!results.length) {
    reg = new RegExp(str, 'i')
    results = lists.filter((item) => {
      return reg.test(item)
    })
  }
  results.sort(function (a,b){return a.value > b.value ? 1 : -1;})
  return results
}

function matchContext (item) {
  let lists = contexts[item.context]
  if (item.value) {
    let str = item.value
    lists = lists.filter((item) => {
      return item.includes(str)
    })
  }
  return lists
}

export default ({editor, store, view, packageInfo, baseClass}) => {
  // load integrated words
  loadIntegratedWords()
  // subscribe change file
  store.subscribe((mutation, state) => {
    if (['EDITOR_SET_FILE_TYPE','FILE_CREATE'].includes(mutation.type) && store.state.editor.promptName === 'videPluginPromptVue') {
      analyseContent(state.editor.content)
    }
  })
  editor.session.on('change', function (action) {
    if (store.state.editor.promptName === 'videPluginPromptVue' && action.action === 'insert' && action.lines.join('') === '') {
      analyseContent(editor.getValue())
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
  }
}
