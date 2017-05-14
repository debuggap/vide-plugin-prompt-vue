var babylon = require('babylon')
var traverse = require('babel-traverse').default
var fs = require('fs')
var parser = require('vue-template-compiler')

process.on('message', function(data) {
  try{
    var rt = parse(data.filepath)
    process.send(rt)
  } catch (e) {
    process.send(null)
  }
})


function parse (file) {
  var content = fs.readFileSync(file)
  content = content.toString()
  var obj = parser.parseComponent(content)
  var scriptContent = "\n".repeat(content.slice(0, obj.script.start).split('\n').length - 1) + obj.script.content
  
  var result = babylon.parse(scriptContent, {
    sourceType:'module',
    plugins: '*'
  })
  var mapResult = {
    funcs: {},
    component: {
      methods: {},
      variables: []
    }
  }
  traverse(result, {
    ImportDeclaration (path) {
      // 
    },
    ExportDefaultDeclaration (path) {
      path.traverse({
        ObjectProperty (subpath) {
          if (subpath.parentPath.parentPath.type !== 'ExportDefaultDeclaration') {
            return
          }
          // methods
          if (subpath.node.key.name === 'methods') {
            subpath.node.value.properties.forEach((property) => {
              let name = property.key.name
              let params = property.params.map((param) => {
                return param.name ? param.name : param.left.name
              })
              mapResult.component.methods[name] = {
                row: property.loc.start.line,
                params
              }
            })
          } else if (subpath.node.key.name === 'computed') {
            let properties = subpath.node.value.properties
            properties.forEach((property) => {
              if (property.key && property.key.name) {
                mapResult.component.variables.push(property.key.name)
              } else {
                subpath.traverse({
                  SpreadProperty (_path) {
                    _path.traverse({
                      ObjectExpression (__path) {
                        __path.node.properties.forEach((property) => {
                          if (property.key.name) {
                            mapResult.component.variables.push(property.key.name)
                          }
                        })
                      }
                    })
                  }
                })
              }
            })
          }
        },
        ObjectMethod (subpath) {
          if (subpath.parentPath.parentPath.type !== 'ExportDefaultDeclaration') {
            return
          }
          // data
          if (subpath.node.key.name === 'data' && subpath.node.kind === 'method') {
            subpath.traverse({
              ReturnStatement (path) {
                path.node.argument.properties.forEach((property) => {
                  mapResult.component.variables.push(property.key.name)
                })
              }
            })
          }
        }
      })
    },
    FunctionDeclaration (path) {
      let node = path.node
      let name = node.id.name
      let params = []
      try {
        params = node.params.map((param) => {
          if (param.type === 'ObjectPattern') {
            return scriptContent.split('\n')[param.loc.start.line - 1].slice(param.loc.start.column, param.loc.end.column)
          } else {
            return param.name ? param.name : param.left.name
          }
        })
      } catch (e) {}
      let value = {
        row: node.id.loc.start.line,
        params
      }
      mapResult.funcs[name] = value
    }
  })
  return mapResult
}
