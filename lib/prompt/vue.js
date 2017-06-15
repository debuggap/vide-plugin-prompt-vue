'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var context = {
  Vue: ['extend', 'nextTick', 'set', 'delete', 'directive', 'filter', 'component', 'use', 'mixin', 'compile']
};
var variables = ['silent', 'optionMergeStrategies', 'devtools', 'errorHandler', 'ignoredElements', 'keyCodes', 'data', 'props', 'propsData', 'computed', 'methods', 'watch', 'el', 'template', 'render', 'beforeCreate', 'created', 'beforeMount', 'mounted', 'beforeUpdate', 'updated', 'activated', 'deactivated', 'beforeDestroy', 'destroyed', 'directives', 'filters', 'components', 'parent', 'mixins', 'name', 'extends', 'delimiters', 'functional', '$data', '$el', '$options', '$parent', '$root', '$children', '$slots', '$scopedSlots', '$refs', '$isServer', '$watch', '$set', '$delete', '$on', '$once', '$off', '$emit', '$mount', '$forceUpdate', '$nextTick', '$destroy', 'v-text', 'v-html', 'v-show', 'v-if', 'v-else', 'v-else-if', 'v-for', 'v-on', 'v-bind', 'v-model', 'v-pre', 'v-cloak', 'v-once', 'key', 'ref', 'slot', 'component', 'transition', 'transition-group', 'keep-alive', 'slot', 'template', 'script', 'style', 'scoped', 'lang',
// vuex
'commit', 'dispatch', 'replaceState', 'watch', 'subscribe', 'registerModule', 'unregisterModule', 'hotUpdate', 'mapState', 'mapGetters', 'mapActions', 'mapMutations'];

var blocks = [{
  value: 'data () {\n\treturn {\n\t\t\n\t}\n}',
  moveAction: [-2, 2]
}];

['computed', 'methods', 'watch'].forEach(function (item) {
  blocks.push({
    value: item + ': {\n\t\n}',
    moveAction: [-1, 1]
  });
});

['beforeCreate', 'created', 'beforeMount', 'mounted', 'beforeUpdate', 'updated', 'activated', 'deactivated', 'beforeDestroy', 'destroyed'].forEach(function (item) {
  blocks.push({
    value: item + ' () {\n\t\n}',
    moveAction: [-1, 1]
  });
});
exports.default = {
  context: context,
  variables: variables,
  blocks: blocks
};